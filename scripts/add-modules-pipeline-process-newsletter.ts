/**
 * Extends the public API/MCP server to three more modules: pipeline,
 * process, newsletter. sage.validate_grant() (scripts/add-assistant-
 * platform-schema.ts) hardcodes the set of module names a
 * connected_apps.scopes grant may name — a TypeScript-side Module type
 * change alone does nothing at the DB level, so this must be updated in
 * lockstep or granting any of the three new modules would fail with
 * "unknown scope module" the moment a user tried to approve one on the
 * consent screen.
 *
 * Run: cd sage-studio && npx tsx scripts/add-modules-pipeline-process-newsletter.ts
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQL = `
create or replace function sage.validate_grant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_valid_modules text[] := array['todos','knowledge','time_tracking','sites','finance','courses','pipeline','process','newsletter'];
  v_valid_levels text[] := array['none','read','write'];
  k text;
  v text;
begin
  for k, v in select * from jsonb_each_text(new.scopes) loop
    if not (k = any(v_valid_modules)) then raise exception 'unknown scope module: %', k; end if;
    if not (v = any(v_valid_levels)) then raise exception 'invalid scope level for %: %', k, v; end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log("✓ sage.validate_grant() now accepts pipeline/process/newsletter scopes");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
