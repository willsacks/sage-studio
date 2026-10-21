/**
 * M7 — safety CI for the public API/MCP server. Phase 1 ships read-only
 * everywhere (enforced at the DB level by withRls's `BEGIN READ ONLY` —
 * see lib/server/db/with-rls.ts), but this gives a fast, no-DB-required
 * second check that nothing in the operation-registry layer could even
 * attempt a write, and that the privileged (`sage_api`, no RLS) DB paths
 * stay confined to the handful of files that genuinely need them.
 *
 * Run: cd sage-studio && npx tsx scripts/ci-safety-checks.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

let failed = false;

function fail(label: string, detail: string) {
  console.error(`✗ ${label}\n  ${detail}`);
  failed = true;
}

function pass(label: string) {
  console.log(`✓ ${label}`);
}

const OPS_DIR = join(process.cwd(), "lib/server/ops");
const opsFiles = readdirSync(OPS_DIR).filter((f) => f.endsWith(".ts"));

// 1. No mutating SQL verbs in any operation file — phase 1 is read-only
// everywhere; a write tool belongs in phase 2 with its own review, not
// slipped into an op file that runOperation treats as read-only.
const MUTATING_SQL = /\b(insert\s+into|update\s+public\.|delete\s+from\s+public\.|truncate|drop\s+table)\b/i;
for (const file of opsFiles) {
  const content = readFileSync(join(OPS_DIR, file), "utf-8");
  if (MUTATING_SQL.test(content)) {
    fail("no-mutating-sql-in-ops", `${file} contains a mutating SQL verb — phase 1 operations must be read-only.`);
  }
}
if (!failed) pass("no-mutating-sql-in-ops");

// 2. No op file imports the privileged (no-RLS) DB paths. Only
// lib/server/auth/{pat,oauth-flow,bearer}.ts, lib/server/audit/write.ts,
// and lib/queries/admin.ts (the Platform Admin dashboard's own
// cross-user reads) may ever import these.
let privilegedImportFound = false;
for (const file of opsFiles) {
  const content = readFileSync(join(OPS_DIR, file), "utf-8");
  if (/from\s+["']@\/lib\/server\/db\/privileged["']/.test(content) || /withRlsWrite/.test(content)) {
    fail("no-privileged-db-access-in-ops", `${file} imports a privileged/write DB path — operation handlers must only receive ctx.db from withRls.`);
    privilegedImportFound = true;
  }
}
if (!privilegedImportFound) pass("no-privileged-db-access-in-ops");

// 3. runOperation itself must call withRls, never withRlsWrite — this is
// the one real enforcement point (Postgres-level BEGIN READ ONLY), so a
// regression here would silently make every operation writable.
const runOperationPath = join(process.cwd(), "lib/server/contract/run-operation.ts");
const runOperationSrc = readFileSync(runOperationPath, "utf-8");
if (!/\bwithRls\(/.test(runOperationSrc)) {
  fail("run-operation-uses-withRls", "run-operation.ts no longer calls withRls — the read-only guarantee may have been removed.");
} else if (/\bwithRlsWrite\(/.test(runOperationSrc)) {
  fail("run-operation-uses-withRls", "run-operation.ts calls withRlsWrite — every operation would run in a writable transaction.");
} else {
  pass("run-operation-uses-withRls");
}

// 4. No admin-only Supabase client (createAdminClient) anywhere under
// lib/server/ops or the MCP/REST route handlers — cross-user access for
// those must go through withRls (real user) or queryPrivileged (audit
// log / OAuth machinery only), never a blanket RLS bypass.
const ROUTE_DIRS = ["app/api/v1", "app/api/mcp"];
let adminClientFound = false;
function scanForAdminClient(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) scanForAdminClient(full);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      const content = readFileSync(full, "utf-8");
      if (/createAdminClient/.test(content)) {
        fail("no-admin-client-in-api-mcp", `${full} imports createAdminClient — the public API/MCP surface must never use the RLS-bypassing admin client.`);
        adminClientFound = true;
      }
    }
  }
}
for (const dir of [OPS_DIR, ...ROUTE_DIRS]) scanForAdminClient(dir);
if (!adminClientFound) pass("no-admin-client-in-api-mcp");

if (failed) {
  console.error("\nSafety CI failed.");
  process.exit(1);
} else {
  console.log("\nAll safety checks passed.");
}
