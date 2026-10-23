/**
 * M1 of the course-delivery-via-sites project (see the plan this session
 * built from scoping a real feature request: creators selling courses
 * through their own standalone site, paid via Stripe Connect so the
 * money lands directly in the creator's own account, not Sage Studio's
 * platform account).
 *
 * - profiles gets Stripe Connect account tracking + a per-creator
 *   platform-fee-bps override (null = use the 0% code-level default;
 *   an explicit 0 is a real override, not "unset").
 * - courses gets an optional one-to-one link to a dedicated site.
 * - site_pages gets a second, independent gate concept — real login +
 *   course enrollment — kept separate from the existing is_gated
 *   email-capture gate (scripts/add-email-gate-schema.ts), since the
 *   two have entirely different semantics.
 *
 * Run: cd sage-studio && npx tsx scripts/add-course-stripe-connect-and-sites.ts
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

const SQL = `
alter table public.profiles add column if not exists stripe_connect_account_id text;
alter table public.profiles add column if not exists stripe_connect_charges_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_connect_payouts_enabled boolean not null default false;
alter table public.profiles add column if not exists course_platform_fee_bps integer;

alter table public.courses add column if not exists site_id uuid references public.artist_sites(id) on delete set null;

alter table public.site_pages add column if not exists requires_course_enrollment boolean not null default false;
alter table public.site_pages add column if not exists gate_course_id uuid references public.courses(id) on delete set null;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log("✓ Stripe Connect columns added to profiles, site_id added to courses, enrollment-gate columns added to site_pages");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
