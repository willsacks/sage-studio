/**
 * Adds parent_page_id to site_pages so pages can be grouped (one level deep)
 * by dragging one page onto another in the site's page manager.
 * Run: cd sage-studio && npx tsx scripts/add-site-pages-parent-column.ts
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
ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS parent_page_id uuid REFERENCES public.site_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_pages_parent ON public.site_pages(parent_page_id);
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    const { data, error: e2 } = await supabase.from("site_pages").select("parent_page_id").limit(1);
    if (!e2 && data) {
      console.log("✓ parent_page_id column already exists (or was created successfully).");
      return;
    }
    console.error("Column does not exist and could not be added via RPC.");
    console.log("Run this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exit(1);
  } else {
    console.log("✓ parent_page_id column added to site_pages.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
