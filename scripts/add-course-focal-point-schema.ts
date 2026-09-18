/**
 * Adds a cover image focal point to courses, mirroring the same
 * cover_image_focus_x/y pattern already used by site_posts.
 *
 * Run: cd sage-studio && npx tsx scripts/add-course-focal-point-schema.ts
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
    sql: `
      alter table public.courses
        add column if not exists cover_image_focus_x smallint not null default 50,
        add column if not exists cover_image_focus_y smallint not null default 50;
    `,
  } as never);
  if (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
  else console.log("✓ add courses cover image focal point");
}

main().catch((err) => { console.error(err); process.exit(1); });
