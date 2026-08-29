/**
 * Phase 2 of the QuickBooks/Wave import feature adds Invoice + Payment
 * transaction import. Both need to resolve a source system's id back to a
 * Sage Studio row across separate phases/requests (the chunked QuickBooks
 * pull can span many self-re-invocations, so in-memory id maps built
 * during the accounts/customers phase don't survive into the invoice/
 * payment phase) — this adds external_id tracking to chart_of_accounts
 * and invoices, matching the pattern finance_customers already has.
 *
 * Run: cd sage-studio && npx tsx scripts/add-import-phase2-schema.ts
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
-- Plain unique constraints, not partial indexes — Supabase's upsert(..., {
-- onConflict }) generates a bare ON CONFLICT (columns) with no WHERE
-- clause, which can't target a partial index. A plain UNIQUE constraint on
-- a nullable column already lets multiple NULLs coexist without
-- conflicting (standard SQL semantics), which is exactly what's needed
-- for manually-created rows that have no external_id — same pattern
-- finance_customers already uses successfully.
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_entity_external_unique;
ALTER TABLE public.chart_of_accounts ADD CONSTRAINT chart_of_accounts_entity_external_unique UNIQUE (entity_id, external_id);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_entity_external_unique;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_entity_external_unique UNIQUE (entity_id, external_id);
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ Import Phase 2 schema created.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
