/**
 * Adds a whole-books "closed through" date so a bookkeeper's signed-off
 * numbers can't silently change later. Before this, is_locked on
 * journal_entries was only ever set as a side effect of finishing a bank
 * reconciliation on the specific entries it touched — nothing stopped an
 * edit to an unrelated transaction dated back in a month that's already
 * been closed out.
 *
 * Run: cd sage-studio && npx tsx scripts/add-period-lock-schema.ts
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
ALTER TABLE public.finance_entities ADD COLUMN IF NOT EXISTS locked_through_date date;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ finance_entities.locked_through_date added.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
