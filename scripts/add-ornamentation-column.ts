/**
 * Adds ornamentation_key column to artist_sites table.
 * Run: cd sage-studio && npx tsx scripts/add-ornamentation-column.ts
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

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, {
    sql: "ALTER TABLE artist_sites ADD COLUMN IF NOT EXISTS ornamentation_key text;",
  } as never);

  if (error) {
    // Fallback: try direct query if RPC not available
    const { error: e2 } = await supabase
      .from("artist_sites")
      .select("ornamentation_key")
      .limit(1);
    if (e2?.message?.includes("column") && e2.message.includes("does not exist")) {
      console.error("Column does not exist and could not be added via RPC.");
      console.log("Run this SQL manually in the Supabase dashboard:");
      console.log("ALTER TABLE artist_sites ADD COLUMN IF NOT EXISTS ornamentation_key text;");
      process.exit(1);
    } else {
      console.log("✓ ornamentation_key column already exists (or was added successfully).");
    }
  } else {
    console.log("✓ ornamentation_key column added to artist_sites.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
