/**
 * Adds external_id to public.transactions, matching the same pattern
 * chart_of_accounts/invoices/finance_customers already use (scripts/
 * add-import-schema.ts) — lets an imported transaction be matched by the
 * source system's own id so re-running an import updates in place
 * instead of creating a duplicate. Needed for the MCP/API transaction
 * import tool (lib/server/ops/finance-write.ts's financeImportTransaction),
 * which the invoice/payment-only importer didn't need since those two
 * already had external_id from the original QBO/Wave importer.
 *
 * Run: cd sage-studio && npx tsx scripts/add-transactions-external-id.ts
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
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_entity_external_id
  ON public.transactions(entity_id, external_id) WHERE external_id IS NOT NULL;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log("✓ transactions.external_id added, unique per (entity_id, external_id)");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
