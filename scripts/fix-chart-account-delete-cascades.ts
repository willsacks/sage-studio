/**
 * Fixes "Delete these books" (deleteFinanceEntity) failing with a raw
 * foreign-key violation for any entity that has ever had a transaction,
 * journal entry, categorization rule, or bill — which in practice is
 * almost every real entity. Several tables reference chart_of_accounts(id)
 * with no ON DELETE action (defaults to RESTRICT): journal_entry_lines,
 * transaction_splits, categorization_rules, bill_line_items. Deleting a
 * finance_entities row cascades to delete its chart_of_accounts rows and
 * these referencing rows in the same statement, but Postgres doesn't
 * guarantee it resolves the chart_of_accounts deletion only after every
 * independent cascade chain pointing at it has already cleared — so the
 * RESTRICT check can fire before, say, bill_line_items has been cascaded
 * away via bills -> bill_line_items, even though both are being deleted
 * as part of the very same statement.
 *
 * Discovered while cleaning up test entities during a full bookkeeping
 * simulation — deleteFinanceEntity failed with:
 *   "update or delete on table chart_of_accounts violates foreign key
 *    constraint bill_line_items_account_id_fkey"
 *
 * Fix: cascade the leaf tables (they only ever exist because their parent
 * entity does), and SET NULL on bank_accounts.chart_account_id (already
 * nullable — an unmapped bank account, not a reason to block deletion).
 *
 * Run: cd sage-studio && npx tsx scripts/fix-chart-account-delete-cascades.ts
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
ALTER TABLE public.journal_entry_lines DROP CONSTRAINT IF EXISTS journal_entry_lines_account_id_fkey;
ALTER TABLE public.journal_entry_lines ADD CONSTRAINT journal_entry_lines_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.transaction_splits DROP CONSTRAINT IF EXISTS transaction_splits_chart_account_id_fkey;
ALTER TABLE public.transaction_splits ADD CONSTRAINT transaction_splits_chart_account_id_fkey
  FOREIGN KEY (chart_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.categorization_rules DROP CONSTRAINT IF EXISTS categorization_rules_chart_account_id_fkey;
ALTER TABLE public.categorization_rules ADD CONSTRAINT categorization_rules_chart_account_id_fkey
  FOREIGN KEY (chart_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.bill_line_items DROP CONSTRAINT IF EXISTS bill_line_items_account_id_fkey;
ALTER TABLE public.bill_line_items ADD CONSTRAINT bill_line_items_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_chart_account_id_fkey;
ALTER TABLE public.bank_accounts ADD CONSTRAINT bank_accounts_chart_account_id_fkey
  FOREIGN KEY (chart_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ chart_of_accounts delete cascades fixed.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
