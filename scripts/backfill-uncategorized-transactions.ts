/**
 * Fixes the real bug a connected AI assistant (Grok) found while
 * reconciling a real user's books: a transaction with no journal entry
 * (status = "uncategorized", journal_entry_id null) is invisible to
 * every report (lib/finance/reports.ts reads only journal_entry_lines),
 * which silently hid real incoming money ($32,439 across 31 Wells
 * Fargo transactions for one user) from the P&L, balance sheet, and
 * cash balance alike.
 *
 * Going forward, lib/finance/plaid-sync.ts and the CSV importer
 * (app/api/finance/import-transactions/route.ts) post straight to a new
 * "Uncategorized Income"/"Uncategorized Expense" fallback account when
 * no rule matches, instead of leaving the transaction unposted. This
 * script is the one-time catch-up for every transaction that already
 * exists from before that fix: it seeds the new "Uncategorized Income"
 * account on every entity missing it (chart_of_accounts.is_default rows
 * aren't retroactively added by a code change alone), then posts every
 * existing unposted transaction that has a resolvable money account to
 * the matching bucket. Transactions with no resolvable money account
 * (a bank account never mapped to the chart of accounts) are left
 * exactly as they are — there's nothing to post them against yet.
 *
 * Run: cd sage-studio && npx tsx scripts/backfill-uncategorized-transactions.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { postToUncategorizedBucket } from "@/lib/finance/ledger";
import { normalBalanceForType } from "@/lib/finance/default-accounts";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function seedMissingUncategorizedIncomeAccounts(): Promise<Map<string, string>> {
  const { data: entities } = await supabase.from("finance_entities").select("id, owner_id");
  const byEntity = new Map<string, string>(); // entityId -> owner_id
  for (const e of entities ?? []) byEntity.set(e.id, e.owner_id);

  let seeded = 0;
  for (const entityId of byEntity.keys()) {
    const { data: existing } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("entity_id", entityId)
      .eq("name", "Uncategorized Income")
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("chart_of_accounts").insert({
      entity_id: entityId,
      name: "Uncategorized Income",
      account_type: "income",
      account_subtype: "Other Income",
      normal_balance: normalBalanceForType("income"),
      is_default: true,
      display_order: 98,
    });
    if (error) {
      console.error(`✗ entity ${entityId}: failed to seed Uncategorized Income — ${error.message}`);
    } else {
      seeded++;
    }
  }
  console.log(`✓ seeded "Uncategorized Income" on ${seeded} entit${seeded === 1 ? "y" : "ies"} that were missing it`);
  return byEntity;
}

async function backfillUnpostedTransactions(ownerByEntity: Map<string, string>) {
  const { data: unposted, error } = await supabase
    .from("transactions")
    .select("id, entity_id, amount, date, payee_name, money_account_id, bank_account_id, bank_accounts(chart_account_id)")
    .is("journal_entry_id", null);
  if (error) {
    console.error(`✗ failed to query unposted transactions — ${error.message}`);
    process.exitCode = 1;
    return;
  }

  let posted = 0;
  let skippedNoAccount = 0;
  let failed = 0;
  for (const t of unposted ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bankAccount = Array.isArray((t as any).bank_accounts) ? (t as any).bank_accounts[0] : (t as any).bank_accounts;
    const moneyAccountId: string | null = bankAccount?.chart_account_id ?? t.money_account_id;
    if (!moneyAccountId) {
      skippedNoAccount++;
      continue;
    }
    const ownerId = ownerByEntity.get(t.entity_id);
    if (!ownerId) continue;

    const result = await postToUncategorizedBucket(supabase, {
      entityId: t.entity_id,
      transactionId: t.id,
      moneyAccountId,
      amount: Number(t.amount),
      date: t.date,
      payeeName: t.payee_name,
      createdBy: ownerId,
    });
    if ("error" in result) {
      console.error(`✗ transaction ${t.id} (${t.payee_name}, ${t.date}): ${result.error}`);
      failed++;
    } else {
      posted++;
    }
  }

  console.log(`✓ posted ${posted} previously-unposted transaction(s) to their entity's Uncategorized Income/Expense bucket`);
  if (skippedNoAccount > 0) console.log(`  (${skippedNoAccount} skipped — no money account mapped yet, nothing to post against)`);
  if (failed > 0) console.log(`  (${failed} failed — see errors above, usually a locked period)`);
}

async function main() {
  const ownerByEntity = await seedMissingUncategorizedIncomeAccounts();
  await backfillUnpostedTransactions(ownerByEntity);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
