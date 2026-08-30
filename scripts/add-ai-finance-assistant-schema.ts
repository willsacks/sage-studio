/**
 * Adds the opt-in flag for the new AI categorization assistant on the
 * Transactions tab. Kept as its own column, separate from the existing
 * `ai_assistant_enabled` (the site-content AI editor) — this assistant can
 * mutate real financial data (create accounts, post journal entries), a
 * materially higher-stakes capability than editing site content, so it
 * gets its own explicit opt-in rather than piggybacking on that flag.
 *
 * Run: cd sage-studio && npx tsx scripts/add-ai-finance-assistant-schema.ts
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
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_finance_assistant_enabled boolean NOT NULL DEFAULT false;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ ai_finance_assistant_enabled column added.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
