/**
 * M3 — additional sage_api grants needed by the OAuth authorization
 * server. M1's schema only gave sage_api `select` on connected_apps
 * (plus full access to the OAuth machinery tables) because at the time
 * the only privileged write path was the PAT last_used_at touch, which
 * is fire-and-forget and silently swallows failures. The OAuth flow
 * needs real (non-silent) updates: revoking a grant on auth-code/
 * refresh-token reuse detection, and touching last_used_at on a
 * successful OAuth-token request.
 *
 * Run: cd sage-studio && npx tsx scripts/add-oauth-m3-grants.ts
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

const sql = `
  grant update (status, revoke_reason, last_used_at) on sage.connected_apps to sage_api;
  drop policy if exists p_api_write on sage.connected_apps;
  create policy p_api_write on sage.connected_apps for update to sage_api using (true) with check (true);
`;

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql } as never);
  if (error) {
    console.error("✗", error.message);
    process.exitCode = 1;
  } else {
    console.log("✓ sage_api can now update connected_apps(status, revoke_reason, last_used_at)");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
