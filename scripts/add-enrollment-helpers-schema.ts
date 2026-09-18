/**
 * A single helper function for manual course enrollment (Track B, B3):
 * resolving an invited email to an existing Sage Studio account id.
 * supabase-js's admin API has no getUserByEmail/listUsers-by-email in the
 * installed SDK version, so this reads auth.users directly instead —
 * service_role-only execute, and it only ever returns an id, never any
 * other account data.
 *
 * Run: cd sage-studio && npx tsx scripts/add-enrollment-helpers-schema.ts
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
    label: "create get_user_id_by_email helper",
    sql: `
      create or replace function public.get_user_id_by_email(p_email text)
      returns uuid language sql security definer set search_path = public, auth stable as $$
        select id from auth.users where lower(email) = lower(p_email) limit 1;
      $$;
      revoke all on function public.get_user_id_by_email(text) from public, anon, authenticated;
      grant execute on function public.get_user_id_by_email(text) to service_role;
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
