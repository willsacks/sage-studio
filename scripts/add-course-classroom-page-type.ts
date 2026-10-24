/**
 * site_pages.page_type has a CHECK constraint listing its allowed
 * values — adding a new value in code (page_type: "course_classroom",
 * used by createSiteForCourse and the public route's classroom branch)
 * isn't enough; the DB rejects the insert until the constraint itself
 * is widened, the same "TS-only change doesn't change the DB" lesson
 * from sage.validate_grant() (scripts/add-modules-pipeline-process-
 * newsletter.ts) earlier this session.
 *
 * Run: cd sage-studio && npx tsx scripts/add-course-classroom-page-type.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Full list confirmed via a live query of every distinct page_type value
// actually in use today (custom, html, work, offer, home, contact,
// about), plus the new course_classroom value — not guessed from code,
// since lib/db.ts's page_type field is typed as plain `string` and
// doesn't enumerate the real constraint.
const SQL = `
alter table public.site_pages drop constraint if exists site_pages_page_type_check;
alter table public.site_pages add constraint site_pages_page_type_check
  check (page_type in ('home', 'about', 'work', 'contact', 'custom', 'html', 'offer', 'course_classroom'));
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log("✓ site_pages_page_type_check now allows 'course_classroom'");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
