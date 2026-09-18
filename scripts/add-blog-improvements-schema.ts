/**
 * Small schema additions for the blog feedback round: a focal point for
 * post cover images (mirrors the focus_x/focus_y pattern already used by
 * offer-builder blocks — see components/ui/focus-point-picker.tsx) and two
 * site-level blog settings (a rename, and whether it shows in the nav at
 * all).
 *
 * Run: cd sage-studio && npx tsx scripts/add-blog-improvements-schema.ts
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

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "add site_posts cover image focal point",
    sql: `
      alter table public.site_posts
        add column if not exists cover_image_focus_x smallint not null default 50,
        add column if not exists cover_image_focus_y smallint not null default 50;
    `,
  },
  {
    label: "add artist_sites blog settings",
    sql: `
      alter table public.artist_sites
        add column if not exists blog_label text not null default 'Blog',
        add column if not exists show_blog_in_nav boolean not null default true;
    `,
  },
];

async function main() {
  let failed = false;
  for (const { label, sql } of STATEMENTS) {
    const { error } = await supabase.rpc("exec_sql" as never, { sql } as never);
    if (error) {
      console.error(`✗ ${label}: ${error.message}`);
      console.log(sql);
      failed = true;
    } else {
      console.log(`✓ ${label}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
