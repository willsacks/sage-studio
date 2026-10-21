/**
 * M7 — lets sage_api read sage.api_audit_log for the Platform Admin
 * dashboard. M1 only granted sage_api `insert` on this table (the only
 * privileged write path at the time — writeAuditLog). The dashboard's
 * getRecentApiAuditLog() needs a real select grant; its own
 * canManagePlatform() page gate is the actual authorization, same as
 * every other admin page's cross-user queries.
 *
 * Run: cd sage-studio && npx tsx scripts/add-audit-log-admin-grant.ts
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
  grant select on sage.api_audit_log to sage_api;
  drop policy if exists p_api_select on sage.api_audit_log;
  create policy p_api_select on sage.api_audit_log for select to sage_api using (true);
`;

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql } as never);
  if (error) {
    console.error("✗", error.message);
    process.exitCode = 1;
  } else {
    console.log("✓ sage_api can now select from sage.api_audit_log");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
