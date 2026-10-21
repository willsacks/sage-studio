import "@/lib/server/db/pg-types";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

/** Connects as sage_api itself — no SET ROLE, no auth.uid(), governed
 * entirely by sage_api's own RLS policies (the permissive "for all to
 * sage_api using (true)" ones on the OAuth machinery tables, and the
 * select-only one on connected_apps/api_audit_log — see
 * scripts/add-assistant-platform-schema.ts). Only two things need this:
 * resolving a bearer token to a grant before we know who the user is
 * (lib/server/auth/bearer.ts), and appending to the audit log (which no
 * user's own session should be able to forge). Nothing else may import
 * this — see the plan's privileged-paths list. */

let pool: Pool | null = null;

function getPrivilegedPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.SAGE_API_DATABASE_URL;
  if (!connectionString) throw new Error("SAGE_API_DATABASE_URL is not set.");
  pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 5000 });
  attachDatabasePool(pool);
  return pool;
}

export async function queryPrivileged<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> {
  const client = await getPrivilegedPool().connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
