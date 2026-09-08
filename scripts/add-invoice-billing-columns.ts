/**
 * Adds invoice_id to time_entries (marks billed entries) and
 * default_hourly_rate to clients (pre-fills rate at invoice creation).
 * Run: cd sage-studio && npx tsx scripts/add-invoice-billing-columns.ts
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
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_invoice ON public.time_entries(invoice_id);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS default_hourly_rate numeric(10,2);
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    // Check if columns already exist
    const { error: e1 } = await supabase.from("time_entries").select("invoice_id").limit(1);
    const { error: e2 } = await supabase.from("clients").select("default_hourly_rate").limit(1);
    if (!e1 && !e2) {
      console.log("✓ Columns already exist.");
      return;
    }
    console.error("Could not add columns via RPC. Run this SQL manually in the Supabase dashboard:\n");
    console.log(SQL);
    process.exit(1);
  } else {
    console.log("✓ invoice_id added to time_entries.");
    console.log("✓ default_hourly_rate added to clients.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
