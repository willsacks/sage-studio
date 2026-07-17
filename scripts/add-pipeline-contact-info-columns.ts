/**
 * Adds email and phone columns to pipeline_contacts.
 * Run: cd sage-studio && npx tsx scripts/add-pipeline-contact-info-columns.ts
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
ALTER TABLE public.pipeline_contacts
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    const { data, error: e2 } = await supabase.from("pipeline_contacts").select("email, phone").limit(1);
    if (!e2 && data) {
      console.log("✓ email/phone columns already exist (or were created successfully).");
      return;
    }
    console.error("Columns do not exist and could not be added via RPC.");
    console.log("Run this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exit(1);
  } else {
    console.log("✓ email and phone columns added to pipeline_contacts.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
