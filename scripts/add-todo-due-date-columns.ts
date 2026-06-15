/**
 * Adds due_date and position columns to todos table.
 * Run: cd sage-studio && npx tsx scripts/add-todo-due-date-columns.ts
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

const SQL = `
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS position double precision NOT NULL DEFAULT 0;
`;

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    const { error: e2 } = await supabase.from("todos").select("due_date, position").limit(1);
    if (e2?.message?.includes("column") && e2.message.includes("does not exist")) {
      console.error("Columns do not exist and could not be added via RPC.");
      console.log("Run this SQL manually in the Supabase dashboard:");
      console.log(SQL);
      process.exit(1);
    } else {
      console.log("✓ due_date/position columns already exist (or were added successfully).");
    }
  } else {
    console.log("✓ due_date and position columns added to todos.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
