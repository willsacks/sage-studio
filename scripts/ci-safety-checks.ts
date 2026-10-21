/**
 * M7 — safety CI for the public API/MCP server, updated for phase 2
 * (write tools). The read-only guarantee is now per-operation, not
 * per-file: an operation's `mutates: true` flag is what makes
 * run-operation.ts use a writable transaction (lib/server/db/with-rls.ts's
 * withRlsWrite) instead of the default `BEGIN READ ONLY`. This script
 * checks the parts of that guarantee a quick, no-DB-required static scan
 * actually can: mutating SQL only appears in files explicitly declared
 * as write-capable below, every operation in those files is honest about
 * it (`mutates: true` + `minScope: "write"`), and the privileged
 * (`sage_api`, no RLS) DB paths stay confined to the handful of files
 * that genuinely need them. (registry.ts also asserts `mutates:true =>
 * minScope:"write"` at import time — this is the complementary static
 * check that catches it before that code ever runs.)
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

// Files allowed to contain mutating SQL at all. Adding a new write-ops
// file means adding it here deliberately — that's the point.
const WRITE_FILES = new Set([
  "todos-write.ts",
  "knowledge-write.ts",
  "time-entries-write.ts",
  "sites-write.ts",
  "finance-write.ts",
  "courses-write.ts",
]);

// 1. Mutating SQL only in declared write files, and every operation in
// those files is explicit about being a write (mutates:true + write
// scope) — not just one operation in the file quietly riding along.
// Line comments are stripped first — otherwise `//mutates: true,` (code
// that was commented out, accidentally or otherwise) would still count
// as a declared write, which defeats the entire point of this check.
function stripLineComments(src: string): string {
  return src.replace(/\/\/.*$/gm, "");
}
const MUTATING_SQL = /\b(insert\s+into|update\s+public\.|delete\s+from\s+public\.|truncate|drop\s+table)\b/i;
// A file can also mutate indirectly, via the PgSupabaseShim wrapper
// around lib/finance/import-commit.ts's business logic (see
// lib/server/db/supabase-shim.ts) rather than literal SQL text of its
// own — that's just as much a write path and needs the same scrutiny.
const USES_SHIM = /PgSupabaseShim/;
for (const file of opsFiles) {
  const content = stripLineComments(readFileSync(join(OPS_DIR, file), "utf-8"));
  const hasMutatingSql = MUTATING_SQL.test(content) || USES_SHIM.test(content);
  if (hasMutatingSql && !WRITE_FILES.has(file)) {
    fail("mutating-sql-only-in-write-files", `${file} contains a mutating SQL verb or uses PgSupabaseShim but isn't in WRITE_FILES — either it shouldn't be mutating, or this script needs updating deliberately.`);
  }
  if (WRITE_FILES.has(file)) {
    const opCount = (content.match(/defineOperation\(/g) ?? []).length;
    const mutatesCount = (content.match(/mutates:\s*true/g) ?? []).length;
    const writeScopeCount = (content.match(/minScope:\s*"write"/g) ?? []).length;
    if (opCount === 0) {
      fail("mutating-sql-only-in-write-files", `${file} is in WRITE_FILES but defines no operations — remove it from the allowlist.`);
    } else if (mutatesCount !== opCount || writeScopeCount !== opCount) {
      fail("mutating-sql-only-in-write-files", `${file} has ${opCount} operation(s) but only ${mutatesCount} with mutates:true and ${writeScopeCount} with minScope:"write" — every operation in a write file must declare both.`);
    }
  }
}
if (!failed) pass("mutating-sql-only-in-write-files");

// 2. No op file imports the privileged (no-RLS) DB paths. Only
// lib/server/auth/{pat,oauth-flow,bearer}.ts, lib/server/audit/write.ts,
// and lib/queries/admin.ts (the Platform Admin dashboard's own
// cross-user reads) may ever import these.
let privilegedImportFound = false;
for (const file of opsFiles) {
  const content = stripLineComments(readFileSync(join(OPS_DIR, file), "utf-8"));
  if (/from\s+["']@\/lib\/server\/db\/privileged["']/.test(content) || /withRlsWrite/.test(content)) {
    fail("no-privileged-db-access-in-ops", `${file} imports a privileged/write DB path — operation handlers must only receive ctx.db from withRls.`);
    privilegedImportFound = true;
  }
}
if (!privilegedImportFound) pass("no-privileged-db-access-in-ops");

// 3. run-operation.ts must still be ABLE to run read-only (withRls is
// referenced) and its use of the writable path must stay conditioned on
// the operation's own flag — not unconditional, which would make every
// operation writable regardless of what it declares.
const runOperationPath = join(process.cwd(), "lib/server/contract/run-operation.ts");
const runOperationSrc = stripLineComments(readFileSync(runOperationPath, "utf-8"));
if (!/\bwithRls\b/.test(runOperationSrc)) {
  fail("run-operation-dispatches-by-mutates", "run-operation.ts no longer references withRls at all — the read-only path may have been removed.");
} else if (!/\bwithRlsWrite\b/.test(runOperationSrc)) {
  fail("run-operation-dispatches-by-mutates", "run-operation.ts no longer references withRlsWrite — phase 2 write operations would have no writable path.");
} else if (!/op\.mutates/.test(runOperationSrc)) {
  fail("run-operation-dispatches-by-mutates", "run-operation.ts doesn't reference op.mutates — the choice between withRls/withRlsWrite may no longer be gated by the operation's own declaration.");
} else {
  pass("run-operation-dispatches-by-mutates");
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
      const content = stripLineComments(readFileSync(full, "utf-8"));
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
