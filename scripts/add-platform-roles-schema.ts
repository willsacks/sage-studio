/**
 * Adds two account-level roles alongside the existing member/admin:
 * - manager: can use every non-destructive part of Platform Admin
 *   (metrics, AI settings, pricing/discounts) but not destructive actions
 *   (only admin gets those).
 * - customer_success: can look up a user's account (their sites, courses,
 *   plan) to help with support, but has no write access anywhere in
 *   Platform Admin.
 *
 * Distinct from site_collaborators.role, which is a per-site permission
 * (owner/manager/editor/viewer) — this is an account-wide platform role
 * on profiles.role. The literal "manager" value exists in both, but
 * they're unrelated columns on unrelated tables.
 *
 * Run: cd sage-studio && npx tsx scripts/add-platform-roles-schema.ts
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
      alter table public.profiles drop constraint if exists profiles_role_check;
      alter table public.profiles add constraint profiles_role_check
        check (role = any (array['member','moderator','admin','manager','customer_success']));
    `,
  } as never);
  if (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
  else console.log("✓ profiles.role accepts manager/customer_success");
}

main().catch((err) => { console.error(err); process.exit(1); });
