/**
 * Adds ai_assistant_enabled column to profiles table (default false).
 * With the Supabase CLI now linked, run via:
 *   supabase db query --linked "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_assistant_enabled boolean NOT NULL DEFAULT false;"
 * Or run this script: cd sage-studio && npx tsx scripts/add-ai-assistant-enabled.ts
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SQL = "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_assistant_enabled boolean NOT NULL DEFAULT false;";

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    const { error: e2 } = await supabase.from("profiles").select("ai_assistant_enabled").limit(1);
    if (e2?.message?.includes("does not exist")) {
      console.error("Column does not exist. Run manually:\n" + SQL);
      process.exit(1);
    } else {
      console.log("✓ ai_assistant_enabled column already exists.");
    }
  } else {
    console.log("✓ ai_assistant_enabled column added to profiles.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
