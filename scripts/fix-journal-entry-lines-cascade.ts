/**
 * journal_entry_lines.account_id referenced chart_of_accounts(id) with no
 * ON DELETE action, so deleting a finance entity with any real ledger
 * activity failed with a foreign key violation — chart_of_accounts rows
 * cascade-deleted from finance_entities, but journal_entry_lines rows
 * pointing at them via account_id had nothing telling Postgres what to do.
 * Confirmed live: deleting a test entity that had QuickBooks-imported
 * payments (which post journal entries) failed with exactly this error.
 * This affects the existing "Delete entity" feature for ANY entity with
 * transaction history, not just imports.
 *
 * Run: cd sage-studio && npx tsx scripts/fix-journal-entry-lines-cascade.ts
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
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ journal_entry_lines.account_id now cascades on delete.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
