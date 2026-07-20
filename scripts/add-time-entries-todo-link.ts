/**
 * Links time_entries to todos so starting a todo can drive the time tracker.
 * Run: cd sage-studio && npx tsx scripts/add-time-entries-todo-link.ts
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
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS todo_id uuid REFERENCES public.todos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_todo ON public.time_entries(todo_id);
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    const { data, error: e2 } = await supabase.from("time_entries").select("todo_id").limit(1);
    if (!e2 && data) {
      console.log("✓ todo_id column already exists (or was created successfully).");
      return;
    }
    console.error("Column does not exist and could not be added via RPC.");
    console.log("Run this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exit(1);
  } else {
    console.log("✓ todo_id column added to time_entries.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
