/**
 * Adds artist_sites.blog_slug — the URL segment the blog actually lives
 * at (e.g. "writing" for a blog renamed to "Writing"), derived from
 * blog_label whenever it's saved (see lib/actions/sites.ts's updateSite).
 *
 * Run: cd sage-studio && npx tsx scripts/add-blog-slug-schema.ts
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
    sql: `alter table public.artist_sites add column if not exists blog_slug text not null default 'blog';`,
  } as never);
  if (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
  else console.log("✓ add artist_sites.blog_slug");
}

main().catch((err) => { console.error(err); process.exit(1); });
