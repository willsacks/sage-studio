"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { postJournalEntry, reverseJournalEntry } from "@/lib/finance/ledger";
import { buildJournalLines, validateSplits, type SplitInput } from "@/lib/finance/categorize";
import { logFinanceAudit } from "@/lib/finance/audit";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** One-shot manual entry — Wave-style single form with both the money
 * account and category chosen at once, rather than a separate
 * uncategorized→categorize step (that two-step flow is reserved for
 * bank-fed transactions in Phase 2). */
export async function createManualTransaction(params: {
  entityId: string;
  moneyAccountId: string;
  date: string;
  payeeName: string;
  amount: number;
  notes?: string;
  splits: SplitInput[];
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  if (!params.payeeName.trim()) return { error: "A payee/description is required" };
  if (params.amount === 0) return { error: "Amount can't be zero" };
  const splitError = validateSplits(params.splits, params.amount);
  if (splitError) return { error: splitError };

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({
      entity_id: params.entityId,
      money_account_id: params.moneyAccountId,
      date: params.date,
      payee_name: params.payeeName.trim(),
      amount: params.amount,
      status: "categorized",
      is_split: params.splits.length > 1,
      notes: params.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (txnError || !txn) return { error: txnError?.message ?? "Failed to create transaction" };

  const posted = await postJournalEntry(supabase, {
    entityId: params.entityId,
    entryDate: params.date,
    description: params.payeeName.trim(),
    sourceType: "manual",
    sourceTransactionId: txn.id,
    createdBy: user.id,
    lines: buildJournalLines(params.moneyAccountId, params.amount, params.splits),
  });
  if ("error" in posted) {
    await supabase.from("transactions").delete().eq("id", txn.id);
    return { error: posted.error };
  }

  const { error: splitsError } = await supabase.from("transaction_splits").insert(
    params.splits.map((s) => ({
      transaction_id: txn.id,
      chart_account_id: s.accountId,
      project_id: s.projectId ?? null,
      amount: s.amount,
      memo: s.memo ?? null,
    }))
  );
  if (splitsError) return { error: splitsError.message };

  await supabase.from("transactions").update({ journal_entry_id: posted.journalEntryId }).eq("id", txn.id);

  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: user.id,
    action: "transaction.created",
    targetTable: "transactions",
    targetId: txn.id,
    diff: { payeeName: params.payeeName.trim(), amount: params.amount, splits: params.splits },
  });

  revalidatePath("/finances");
  return { transactionId: txn.id as string };
}

/** Categorizes an already-existing uncategorized transaction (bank-fed or
 * CSV-imported). Resolves the money account from the transaction's own
 * bank_accounts row when it's Plaid-linked, falling back to
 * money_account_id for CSV-imported transactions that aren't tied to any
 * bank_accounts row. Also clears any "needs review" flag a collaborator
 * (e.g. a bookkeeper) set — categorizing an item is how it gets resolved. */
export async function categorizeTransaction(transactionId: string, entityId: string, splits: SplitInput[]) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .select("id, amount, date, payee_name, bank_account_id, money_account_id, journal_entry_id, bank_accounts(chart_account_id)")
    .eq("id", transactionId)
    .eq("entity_id", entityId)
    .single();
  if (txnError || !txn) return { error: txnError?.message ?? "Transaction not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bankAccount = Array.isArray((txn as any).bank_accounts) ? (txn as any).bank_accounts[0] : (txn as any).bank_accounts;
  const moneyAccountId = bankAccount?.chart_account_id ?? txn.money_account_id;
  if (!moneyAccountId) return { error: "This account hasn't been mapped to a chart of accounts entry yet" };

  const splitError = validateSplits(splits, txn.amount);
  if (splitError) return { error: splitError };

  if (txn.journal_entry_id) {
    const reversed = await reverseJournalEntry(supabase, txn.journal_entry_id, user.id);
    if ("error" in reversed) return { error: reversed.error };
    await supabase.from("transaction_splits").delete().eq("transaction_id", transactionId);
  }

  const posted = await postJournalEntry(supabase, {
    entityId,
    entryDate: txn.date,
    description: txn.payee_name,
    sourceType: "bank_transaction",
    sourceTransactionId: transactionId,
    createdBy: user.id,
    lines: buildJournalLines(moneyAccountId, txn.amount, splits),
  });
  if ("error" in posted) return { error: posted.error };

  const { error: splitsError } = await supabase.from("transaction_splits").insert(
    splits.map((s) => ({
      transaction_id: transactionId,
      chart_account_id: s.accountId,
      project_id: s.projectId ?? null,
      amount: s.amount,
      memo: s.memo ?? null,
    }))
  );
  if (splitsError) return { error: splitsError.message };

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "categorized",
      is_split: splits.length > 1,
      journal_entry_id: posted.journalEntryId,
      needs_review: false,
      review_note: null,
      flagged_by: null,
      flagged_at: null,
    })
    .eq("id", transactionId);
  if (updateError) return { error: updateError.message };

  await logFinanceAudit(supabase, {
    entityId,
    actorId: user.id,
    action: "transaction.categorized",
    targetTable: "transactions",
    targetId: transactionId,
    diff: { splits },
  });

  revalidatePath("/finances");
  return { success: true };
}

/** A collaborator (e.g. a bookkeeper) flags a transaction — categorized or
 * not — for the owner to look at, with an optional note explaining why
 * they couldn't decide themselves. Requires the same "editor" role as
 * categorizing, since RLS's WITH CHECK on transactions already requires
 * that minimum for any update. */
export async function flagTransactionForReview(transactionId: string, entityId: string, note?: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase
    .from("transactions")
    .update({ needs_review: true, review_note: note?.trim() || null, flagged_by: user.id, flagged_at: new Date().toISOString() })
    .eq("id", transactionId)
    .eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

/** Clears a review flag without changing the transaction's category —
 * for when the owner looks at a flagged item and decides it's fine as-is. */
export async function resolveReviewFlag(transactionId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase
    .from("transactions")
    .update({ needs_review: false, review_note: null, flagged_by: null, flagged_at: null })
    .eq("id", transactionId)
    .eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

export async function updateTransactionNote(transactionId: string, entityId: string, note: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase
    .from("transactions")
    .update({ notes: note.trim() || null })
    .eq("id", transactionId)
    .eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

export async function excludeTransaction(transactionId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("transactions").update({ status: "excluded" }).eq("id", transactionId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  await logFinanceAudit(supabase, { entityId, actorId: user.id, action: "transaction.excluded", targetTable: "transactions", targetId: transactionId });
  revalidatePath("/finances");
  return { success: true };
}

export async function deleteManualTransaction(transactionId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: txn } = await supabase
    .from("transactions")
    .select("journal_entry_id, bank_account_id")
    .eq("id", transactionId)
    .eq("entity_id", entityId)
    .single();
  if (!txn) return { error: "Transaction not found" };
  if (txn.bank_account_id) return { error: "Bank-synced transactions can't be deleted — exclude them instead" };

  if (txn.journal_entry_id) {
    const reversed = await reverseJournalEntry(supabase, txn.journal_entry_id, user.id);
    if ("error" in reversed) return { error: reversed.error };
  }

  const { error } = await supabase.from("transactions").delete().eq("id", transactionId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  await logFinanceAudit(supabase, { entityId, actorId: user.id, action: "transaction.deleted", targetTable: "transactions", targetId: transactionId });
  revalidatePath("/finances");
  return { success: true };
}

export async function listTransactions(params: {
  entityId: string;
  projectId?: string;
  status?: "uncategorized" | "categorized" | "excluded";
  startDate?: string;
  endDate?: string;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "viewer");

  let query = supabase
    .from("transactions")
    .select("*, transaction_splits(*), bank_accounts(chart_account_id)")
    .eq("entity_id", params.entityId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);
  if (params.startDate) query = query.gte("date", params.startDate);
  if (params.endDate) query = query.lte("date", params.endDate);

  const { data, error } = await query;
  if (error) return { error: error.message, transactions: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (data ?? []) as any[];
  if (params.projectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows = rows.filter((t) => (t.transaction_splits as any[]).some((s) => s.project_id === params.projectId));
  }
  return { transactions: rows };
}
