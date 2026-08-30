/**
 * Follow-up to fix-journal-entry-lines-cascade.ts: every other FK pointing
 * at chart_of_accounts(id) has the exact same missing-ON-DELETE-action gap
 * (transactions.money_account_id, bank_accounts.chart_account_id,
 * transaction_splits.chart_account_id, categorization_rules.chart_account_id).
 * Deleting a finance entity with any real transaction history failed
 * repeatedly, one FK at a time, until every one of these was fixed —
 * fixing them all in one pass instead of waiting for the next one to surface.
 *
 * Run: cd sage-studio && npx tsx scripts/fix-chart-of-accounts-cascade.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQL = `
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_money_account_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_money_account_id_fkey
  FOREIGN KEY (money_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_chart_account_id_fkey;
ALTER TABLE public.bank_accounts ADD CONSTRAINT bank_accounts_chart_account_id_fkey
  FOREIGN KEY (chart_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.transaction_splits DROP CONSTRAINT IF EXISTS transaction_splits_chart_account_id_fkey;
ALTER TABLE public.transaction_splits ADD CONSTRAINT transaction_splits_chart_account_id_fkey
  FOREIGN KEY (chart_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.categorization_rules DROP CONSTRAINT IF EXISTS categorization_rules_chart_account_id_fkey;
ALTER TABLE public.categorization_rules ADD CONSTRAINT categorization_rules_chart_account_id_fkey
  FOREIGN KEY (chart_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ Remaining chart_of_accounts foreign keys now have a delete action.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
