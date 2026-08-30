import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { postJournalEntry } from "@/lib/finance/ledger";
import { buildJournalLines } from "@/lib/finance/categorize";

type Rule = {
  id: string;
  match_type: "contains" | "exact" | "starts_with";
  match_value: string;
  chart_account_id: string;
  default_project_id: string | null;
  priority: number;
};

function matchesRule(payeeName: string, rule: Rule): boolean {
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
