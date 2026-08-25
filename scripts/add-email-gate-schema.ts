/**
 * Schema for the email-gated downloads + Resend sync feature:
 * - email_subscribers: unified capture table for both file-gate and
 *   page-gate submissions.
 * - artist_sites: per-site Resend connection (API key + audience id).
 * - site_pages: per-page gate toggle + copy.
 *
 * Run: cd sage-studio && npx tsx scripts/add-email-gate-schema.ts
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
    label: "create email_subscribers table",
    sql: `
      create table if not exists email_subscribers (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        site_id uuid not null references artist_sites(id) on delete cascade,
        site_slug text not null,
        email text not null,
        source_type text not null,
        source_id text not null,
        resend_synced_at timestamptz,
        resend_sync_error text,
        unique (site_id, email, source_type, source_id)
      );
    `,
  },
  {
    label: "index email_subscribers.site_id",
    sql: `create index if not exists email_subscribers_site_id_idx on email_subscribers (site_id);`,
  },
  {
    label: "artist_sites.resend_api_key_encrypted",
    sql: `alter table artist_sites add column if not exists resend_api_key_encrypted text;`,
  },
  {
    label: "artist_sites.resend_audience_id",
    sql: `alter table artist_sites add column if not exists resend_audience_id text;`,
  },
  {
    label: "site_pages.is_gated",
    sql: `alter table site_pages add column if not exists is_gated boolean not null default false;`,
  },
  {
    label: "site_pages.gate_title",
    sql: `alter table site_pages add column if not exists gate_title text;`,
  },
  {
    label: "site_pages.gate_description",
    sql: `alter table site_pages add column if not exists gate_description text;`,
  },
  {
    label: "site_pages.gate_button_text",
    sql: `alter table site_pages add column if not exists gate_button_text text;`,
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
