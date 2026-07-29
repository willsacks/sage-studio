/**
 * Creates a singleton platform_settings table for admin-editable global config —
 * currently just the AI page-editor system prompts (see lib/ai/prompts.ts for the
 * hardcoded defaults these override, and lib/actions/admin.ts for the read/write
 * server actions). No RLS policies are added: RLS is enabled with zero grants, so
 * only the service-role client (createAdminClient()) can touch this table.
 * Run: cd sage-studio && npx tsx scripts/add-platform-settings-table.ts
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
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true,
  ai_block_system_prompt text,
  ai_html_system_prompt text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id)
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    const { error: e2 } = await supabase.from("platform_settings").select("id").limit(1);
    if (!e2) {
      console.log("✓ platform_settings already exists (or was created successfully).");
      return;
    }
    console.error("Table does not exist and could not be created via RPC.");
    console.log("Run this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exit(1);
  } else {
    console.log("✓ platform_settings table created.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
