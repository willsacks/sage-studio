/**
 * Backfills transactions.money_account_id for existing rows that have
 * neither money_account_id nor bank_account_id set — every manual
 * transaction (createManualTransaction), bill payment, and invoice
 * payment created before this fix never stored which account the money
 * moved through, only the journal entry did. That silently broke
 * reconciliation for all of them: getReconciliationCandidates
 * (lib/actions/finance-reconciliation.ts) matches on money_account_id/
 * bank_account_id, so these transactions could never be found as
 * candidates no matter how correct their journal entries were.
 *
 * Infers the money account from each transaction's own journal entry:
 * the line whose account has a MONEY_ACCOUNT_SUBTYPES subtype (Cash and
 * Bank / Credit Card / Investment) is the money side, the other line(s)
 * are the category side — the same distinction buildJournalLines
 * (lib/finance/categorize.ts) encodes when posting in the first place.
 *
 * Run: cd sage-studio && npx tsx scripts/backfill-transaction-money-account.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { MONEY_ACCOUNT_SUBTYPES } from "../lib/finance/default-accounts";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: orphans, error } = await supabase
    .from("transactions")
    .select("id, entity_id, journal_entry_id")
    .is("money_account_id", null)
    .is("bank_account_id", null)
    .not("journal_entry_id", "is", null);
  if (error) throw new Error(error.message);
  console.log(`Found ${orphans?.length ?? 0} transactions missing money_account_id.`);
  if (!orphans || orphans.length === 0) return;

  const entityIds = [...new Set(orphans.map((t) => t.entity_id))];
  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("id, entity_id, account_subtype")
    .in("entity_id", entityIds);
  const moneyAccountIdsByEntity = new Map<string, Set<string>>();
  for (const a of accounts ?? []) {
    if (!MONEY_ACCOUNT_SUBTYPES.includes(a.account_subtype)) continue;
    if (!moneyAccountIdsByEntity.has(a.entity_id)) moneyAccountIdsByEntity.set(a.entity_id, new Set());
    moneyAccountIdsByEntity.get(a.entity_id)!.add(a.id);
  }

  const journalEntryIds = [...new Set(orphans.map((t) => t.journal_entry_id!))];
  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select("journal_entry_id, account_id")
    .in("journal_entry_id", journalEntryIds);
  const linesByEntry = new Map<string, string[]>();
  for (const l of lines ?? []) {
    if (!linesByEntry.has(l.journal_entry_id)) linesByEntry.set(l.journal_entry_id, []);
    linesByEntry.get(l.journal_entry_id)!.push(l.account_id);
  }

  let updated = 0;
  let skipped = 0;
  for (const txn of orphans) {
    const moneyAccountIds = moneyAccountIdsByEntity.get(txn.entity_id);
    const entryAccountIds = linesByEntry.get(txn.journal_entry_id!) ?? [];
    const moneyAccountId = entryAccountIds.find((id) => moneyAccountIds?.has(id));
    if (!moneyAccountId) {
      skipped++;
      continue;
    }
    const { error: updateError } = await supabase.from("transactions").update({ money_account_id: moneyAccountId }).eq("id", txn.id);
    if (updateError) {
      console.error(`Failed to update ${txn.id}: ${updateError.message}`);
      continue;
    }
    updated++;
  }
  console.log(`Backfilled ${updated} transactions. Skipped ${skipped} (no identifiable money-account line — e.g. account-to-account transfers with no money-subtype leg, or an account since deleted).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
