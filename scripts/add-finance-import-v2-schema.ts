/**
 * Extends the transaction-import schema (scripts/add-transactions-external-id.ts)
 * for the fuller batch-import spec requested by a real connected assistant
 * (Grok, importing a year of QuickBooks data): adds `source` to
 * transactions (so finance_delete_import can scope an undo to one
 * source/batch) and adds external_id + source to journal_entries (for
 * "pure" journal entries that aren't backed by a transactions row at all
 * — accruals, depreciation, adjusting entries — which is a real, distinct
 * case from a bank/card transaction).
 *
 * Run: cd sage-studio && npx tsx scripts/add-finance-import-v2-schema.ts
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
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS source text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_entity_external_id
  ON public.journal_entries(entity_id, external_id) WHERE external_id IS NOT NULL;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log("✓ transactions.source, journal_entries.external_id/source added");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
