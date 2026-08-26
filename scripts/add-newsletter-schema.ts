/**
 * Schema for the account-level Newsletter feature:
 * - profiles.resend_api_key_encrypted: moves the Resend connection from
 *   per-site (artist_sites) to per-user.
 * - artist_sites.resend_list_ids: replaces the old singular
 *   resend_audience_id — which of the owner's lists this site's captures
 *   feed into.
 * - profiles.hidden_nav_items: per-user sidebar customization.
 *
 * Run: cd sage-studio && npx tsx scripts/add-newsletter-schema.ts
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
    label: "profiles.resend_api_key_encrypted",
    sql: `alter table profiles add column if not exists resend_api_key_encrypted text;`,
  },
  {
    label: "artist_sites.resend_list_ids",
    sql: `alter table artist_sites add column if not exists resend_list_ids text[] not null default '{}';`,
  },
  {
    label: "profiles.hidden_nav_items",
    sql: `alter table profiles add column if not exists hidden_nav_items text[] not null default '{}';`,
  },
];

async function main() {
  for (const { label, sql } of STATEMENTS) {
    const { error } = await supabase.rpc("exec_sql" as never, { sql } as never);
    if (error) {
      console.error(`✗ ${label}: ${error.message}`);
      console.log(`  Run manually in the Supabase SQL editor:\n  ${sql.trim()}`);
      process.exitCode = 1;
    } else {
      console.log(`✓ ${label}`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
