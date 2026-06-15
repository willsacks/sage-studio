/**
 * Adds category column to time_entries table.
 * Run: cd sage-studio && npx tsx scripts/add-time-entry-category-column.ts
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

const SQL = `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS category text;`;

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    const { error: e2 } = await supabase.from("time_entries").select("category").limit(1);
    if (e2?.message?.includes("column") && e2.message.includes("does not exist")) {
      console.error("Column does not exist and could not be added via RPC.");
      console.log("Run this SQL manually in the Supabase dashboard:");
      console.log(SQL);
      process.exit(1);
    } else {
      console.log("✓ category column already exists (or was added successfully).");
    }
  } else {
    console.log("✓ category column added to time_entries.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
