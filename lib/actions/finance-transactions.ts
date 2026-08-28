"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { postJournalEntry, reverseJournalEntry, type JournalLineInput } from "@/lib/finance/ledger";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export type SplitInput = { accountId: string; amount: number; projectId?: string; memo?: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function validateSplits(splits: SplitInput[], amount: number): string | null {
  if (splits.length === 0) return "Choose at least one category";
  const total = round2(splits.reduce((sum, s) => sum + s.amount, 0));
  if (total !== round2(Math.abs(amount))) {
    return `Split amounts (${total}) must add up to the transaction amount (${Math.abs(amount)})`;
  }
  return null;
}

/** Builds the balanced journal-entry lines for a categorized transaction:
 * amount > 0 (cash in) debits the money account and credits each category
 * split (income); amount < 0 (cash out) credits the money account and
 * debits each category split (expense). This holds regardless of whether
 * the money account is an asset or a liability (credit card) — see
 * lib/finance/ledger.ts's callers for the reasoning. */
function buildLines(moneyAccountId: string, amount: number, splits: SplitInput[]): JournalLineInput[] {
  const magnitude = Math.abs(amount);
  const moneyLine: JournalLineInput = amount > 0 ? { accountId: moneyAccountId, debit: magnitude } : { accountId: moneyAccountId, credit: magnitude };
  const categoryLines: JournalLineInput[] = splits.map((s) =>
    amount > 0
      ? { accountId: s.accountId, credit: s.amount, memo: s.memo }
      : { accountId: s.accountId, debit: s.amount, memo: s.memo }
  );
  return [moneyLine, ...categoryLines];
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
    lines: buildLines(params.moneyAccountId, params.amount, params.splits),
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

  revalidatePath("/finances");
  return { transactionId: txn.id as string };
}

/** Categorizes an already-existing uncategorized transaction (bank-fed).
 * Resolves the money account from the transaction's own bank_accounts row. */
export async function categorizeTransaction(transactionId: string, entityId: string, splits: SplitInput[]) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .select("id, amount, date, payee_name, bank_account_id, journal_entry_id, bank_accounts(chart_account_id)")
    .eq("id", transactionId)
    .eq("entity_id", entityId)
    .single();
  if (txnError || !txn) return { error: txnError?.message ?? "Transaction not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bankAccount = Array.isArray((txn as any).bank_accounts) ? (txn as any).bank_accounts[0] : (txn as any).bank_accounts;
  const moneyAccountId = bankAccount?.chart_account_id;
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
    lines: buildLines(moneyAccountId, txn.amount, splits),
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
    .update({ status: "categorized", is_split: splits.length > 1, journal_entry_id: posted.journalEntryId })
    .eq("id", transactionId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/finances");
  return { success: true };
}

export async function excludeTransaction(transactionId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("transactions").update({ status: "excluded" }).eq("id", transactionId).eq("entity_id", entityId);
  if (error) return { error: error.message };
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
    .select("*, transaction_splits(*)")
    .eq("entity_id", params.entityId)
    .order("date", { ascending: false });

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
