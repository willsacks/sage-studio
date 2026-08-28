"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function requireBankAccountEntity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bankAccountId: string,
  entityId: string
) {
  const { data } = await supabase.from("bank_accounts").select("id").eq("id", bankAccountId).eq("entity_id", entityId).maybeSingle();
  if (!data) throw new Error("Bank account not found on this entity");
}

export async function listReconciliations(bankAccountId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");
  await requireBankAccountEntity(supabase, bankAccountId, entityId);

  const { data, error } = await supabase
    .from("reconciliations")
    .select("*")
    .eq("bank_account_id", bankAccountId)
    .order("statement_end_date", { ascending: false });
  if (error) return { error: error.message, reconciliations: [] };
  return { reconciliations: data ?? [] };
}

export async function startReconciliation(params: {
  entityId: string;
  bankAccountId: string;
  statementStartDate: string;
  statementEndDate: string;
  statementEndingBalance: number;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");
  await requireBankAccountEntity(supabase, params.bankAccountId, params.entityId);

  const { data: existing } = await supabase
    .from("reconciliations")
    .select("id")
    .eq("bank_account_id", params.bankAccountId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (existing) return { error: "There's already a reconciliation in progress for this account" };

  const { data: lastCompleted } = await supabase
    .from("reconciliations")
    .select("statement_ending_balance")
    .eq("bank_account_id", params.bankAccountId)
    .eq("status", "completed")
    .order("statement_end_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const beginningBalance = lastCompleted?.statement_ending_balance ?? 0;

  const { data, error } = await supabase
    .from("reconciliations")
    .insert({
      bank_account_id: params.bankAccountId,
      statement_start_date: params.statementStartDate,
      statement_end_date: params.statementEndDate,
      statement_ending_balance: params.statementEndingBalance,
      beginning_balance: beginningBalance,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to start reconciliation" };

  revalidatePath("/finances");
  return { reconciliationId: data.id as string, beginningBalance };
}

export async function getReconciliationCandidates(reconciliationId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data: reconciliation, error: reconError } = await supabase
    .from("reconciliations")
    .select("*, bank_accounts!inner(entity_id)")
    .eq("id", reconciliationId)
    .single();
  if (reconError || !reconciliation) return { error: "Reconciliation not found" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bankAccount = (reconciliation as any).bank_accounts;
  if (bankAccount.entity_id !== entityId) return { error: "Not authorized" };

  const { data: transactions, error: txnError } = await supabase
    .from("transactions")
    .select("id, date, payee_name, amount, cleared_at, reconciliation_id")
    .eq("bank_account_id", reconciliation.bank_account_id)
    .lte("date", reconciliation.statement_end_date)
    .or(`reconciliation_id.eq.${reconciliationId},reconciliation_id.is.null`)
    .order("date", { ascending: true });
  if (txnError) return { error: txnError.message };

  return { reconciliation, transactions: transactions ?? [] };
}

export async function setTransactionCleared(transactionId: string, reconciliationId: string, entityId: string, cleared: boolean) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: reconciliation } = await supabase.from("reconciliations").select("status").eq("id", reconciliationId).single();
  if (!reconciliation || reconciliation.status !== "in_progress") return { error: "This reconciliation is no longer in progress" };

  const { error } = await supabase
    .from("transactions")
    .update(cleared ? { cleared_at: new Date().toISOString(), reconciliation_id: reconciliationId } : { cleared_at: null, reconciliation_id: null })
    .eq("id", transactionId)
    .eq("entity_id", entityId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function finishReconciliation(reconciliationId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: reconciliation } = await supabase.from("reconciliations").select("*").eq("id", reconciliationId).single();
  if (!reconciliation) return { error: "Reconciliation not found" };

  const { data: cleared } = await supabase.from("transactions").select("amount, journal_entry_id").eq("reconciliation_id", reconciliationId);
  const clearedTotal = (cleared ?? []).reduce((sum, t) => sum + t.amount, 0);
  const difference = Math.round((reconciliation.statement_ending_balance - (reconciliation.beginning_balance + clearedTotal)) * 100) / 100;
  if (difference !== 0) return { error: `Doesn't balance yet — off by ${difference}` };

  await supabase
    .from("reconciliations")
    .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: user.id })
    .eq("id", reconciliationId);

  const journalEntryIds = [...new Set((cleared ?? []).map((t) => t.journal_entry_id).filter(Boolean))];
  if (journalEntryIds.length > 0) {
    await supabase.from("journal_entries").update({ is_locked: true }).in("id", journalEntryIds as string[]);
  }

  revalidatePath("/finances");
  return { success: true };
}

/** Only the most recent reconciliation on an account can be reopened —
 * reconcile-in-order, matching Wave's model, so unwinding one can't create
 * gaps in the middle of an account's history. */
export async function reopenReconciliation(reconciliationId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: reconciliation } = await supabase.from("reconciliations").select("*").eq("id", reconciliationId).single();
  if (!reconciliation) return { error: "Reconciliation not found" };

  const { data: mostRecent } = await supabase
    .from("reconciliations")
    .select("id")
    .eq("bank_account_id", reconciliation.bank_account_id)
    .eq("status", "completed")
    .order("statement_end_date", { ascending: false })
    .limit(1)
    .single();
  if (mostRecent?.id !== reconciliationId) return { error: "Only the most recent reconciliation can be reopened" };

  const { data: cleared } = await supabase.from("transactions").select("journal_entry_id").eq("reconciliation_id", reconciliationId);
  const journalEntryIds = [...new Set((cleared ?? []).map((t) => t.journal_entry_id).filter(Boolean))];
  if (journalEntryIds.length > 0) {
    await supabase.from("journal_entries").update({ is_locked: false }).in("id", journalEntryIds as string[]);
  }

  await supabase.from("reconciliations").update({ status: "in_progress", completed_at: null, completed_by: null }).eq("id", reconciliationId);
  revalidatePath("/finances");
  return { success: true };
}
