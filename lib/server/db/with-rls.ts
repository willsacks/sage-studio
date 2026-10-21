import "@/lib/server/db/pg-types";
import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import type { Principal } from "@/lib/server/auth/principal";

/** The only way API/MCP code touches the database. Runs as Postgres role
 * `authenticated` with `request.jwt.claims` set via `set_config`, so the
 * same RLS policies that already gate the web app gate this too — see
 * docs/schema-map.md for why most modules need no new policy at all, and
 * sage.api_scope_allows() (scripts/add-assistant-platform-schema.ts) for
 * the one that does. Phase-1 (read) operations run in `BEGIN READ ONLY`;
 * phase-2 write operations run via withRlsWrite — run-operation.ts
 * decides which per-call based on the operation's own `mutates: true`
 * flag, never per-route or per-channel. */

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.SAGE_API_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "SAGE_API_DATABASE_URL is not set. Get the Transaction pooler connection string from " +
      "Supabase Dashboard → Project Settings → Database, and substitute the user with " +
      "sage_api.<project-ref> and the password with SAGE_API_DB_PASSWORD (already set in .env.local)."
    );
  }
  pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5000 });
  attachDatabasePool(pool);
  return pool;
}

function claimsFor(p: Principal) {
  return {
    sub: p.userId,
    role: "authenticated",
    aud: "sage-api",
    sage: { channel: p.channel, gid: p.grantId ?? null, scopes: p.scopes },
  };
}

export async function withRls<T>(principal: Principal, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin read only");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claimsFor(principal))]);
    await client.query("set local statement_timeout = '8s'");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Same as withRls but a real (writable) transaction. Two call sites:
 * connection/PAT creation + OAuth consent (lib/server/auth/pat.ts,
 * lib/actions/oauth-consent.ts), and run-operation.ts's own dispatch for
 * any operation with `mutates: true` — never called directly from an
 * ops file itself (see ci-safety-checks.ts's no-privileged-db-access-in-ops
 * check, which also forbids importing this from lib/server/ops). */
export async function withRlsWrite<T>(principal: Principal, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claimsFor(principal))]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
