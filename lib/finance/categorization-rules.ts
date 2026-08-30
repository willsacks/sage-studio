import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { postJournalEntry } from "@/lib/finance/ledger";
import { buildJournalLines } from "@/lib/finance/categorize";
import { categorizeTransaction } from "@/lib/actions/finance-transactions";

export type CategorizationRule = {
  id: string;
  match_type: "contains" | "exact" | "starts_with";
  match_value: string;
  chart_account_id: string;
  default_project_id: string | null;
  priority: number;
};
type Rule = CategorizationRule;

/** Exported so any bulk-apply logic (e.g. applyRuleToExistingTransactions
 * below, or the AI categorization assistant) uses the exact same
 * match semantics as ingestion-time auto-categorization, instead of a
 * second implementation that could quietly drift out of sync. */
export function matchesRule(payeeName: string, rule: Rule): boolean {
  const name = payeeName.toLowerCase();
  const value = rule.match_value.toLowerCase();
  if (rule.match_type === "exact") return name === value;
  if (rule.match_type === "starts_with") return name.startsWith(value);
  return name.includes(value);
}

/**
 * Looks up an entity's categorization rules (highest priority first) and,
 * if the payee matches one, posts the journal entry and marks the
 * transaction categorized — the same auto-categorize-on-arrival behavior
 * Plaid-synced transactions already got (lib/finance/plaid-sync.ts), now
 * shared so CSV-imported transactions get it too instead of always landing
 * uncategorized regardless of rules the user has already set up.
 */
export async function applyMatchingRule(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  params: {
    entityId: string;
    transactionId: string;
    moneyAccountId: string;
    payeeName: string;
    amount: number;
    date: string;
    createdBy: string;
  }
): Promise<boolean> {
  const { data: rules } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("entity_id", params.entityId)
    .order("priority", { ascending: true });
  const matchedRule = ((rules ?? []) as Rule[]).find((r) => matchesRule(params.payeeName, r));
  if (!matchedRule) return false;

  const posted = await postJournalEntry(supabase, {
    entityId: params.entityId,
    entryDate: params.date,
    description: params.payeeName,
    sourceType: "bank_transaction",
    sourceTransactionId: params.transactionId,
    createdBy: params.createdBy,
    lines: buildJournalLines(params.moneyAccountId, params.amount, [
      { accountId: matchedRule.chart_account_id, amount: Math.abs(params.amount), projectId: matchedRule.default_project_id ?? undefined },
    ]),
  });
  if ("error" in posted) return false;

  await supabase.from("transaction_splits").insert({
    transaction_id: params.transactionId,
    chart_account_id: matchedRule.chart_account_id,
    project_id: matchedRule.default_project_id,
    amount: Math.abs(params.amount),
  });
  await supabase
    .from("transactions")
    .update({ status: "categorized", journal_entry_id: posted.journalEntryId })
    .eq("id", params.transactionId);

  return true;
}

/**
 * Applies one rule against every ALREADY-EXISTING uncategorized
 * transaction in the entity — the gap `applyMatchingRule` above doesn't
 * cover, since that one only ever runs at ingestion time (a new Plaid
 * transaction or a freshly-imported CSV row). Without this, a rule only
 * ever helps future transactions; the backlog that prompted creating the
 * rule in the first place stays untouched. Goes through
 * `categorizeTransaction` (the canonical categorize-one-transaction path,
 * which resolves the money account, posts the balanced journal entry, and
 * clears any review flag) rather than reimplementing posting here, so
 * behavior stays identical to categorizing that same transaction by hand.
 */
export async function applyRuleToExistingTransactions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  params: { entityId: string; rule: CategorizationRule }
): Promise<{ matchedCount: number }> {
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, payee_name, amount")
    .eq("entity_id", params.entityId)
    .eq("status", "uncategorized");

  const matches = ((transactions ?? []) as { id: string; payee_name: string; amount: number }[]).filter((t) =>
    matchesRule(t.payee_name, params.rule)
  );

  let matchedCount = 0;
  for (const t of matches) {
    const result = await categorizeTransaction(t.id, params.entityId, [
      { accountId: params.rule.chart_account_id, amount: Math.abs(t.amount), projectId: params.rule.default_project_id ?? undefined },
    ]);
    if (!("error" in result)) matchedCount++;
  }
  return { matchedCount };
}
