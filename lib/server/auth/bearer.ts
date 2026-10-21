import { randomUUID } from "crypto";
import { hashAssistantToken } from "@/lib/crypto";
import { queryPrivileged } from "@/lib/server/db/privileged";
import { ALL_MODULES, type Channel, type Module, type Principal, type ScopeLevel } from "@/lib/server/auth/principal";

export type BearerAuthResult = { ok: true; principal: Principal } | { ok: false; error: string };

/** Resolves a bearer token to a Principal. PATs today (`sage_pat_...`);
 * OAuth access tokens (JWT, `jose.jwtVerify`) arrive in M3 — this
 * function is the one place that distinction is made, so adding JWT
 * support later doesn't touch any route or MCP tool code. */
export async function authenticateBearer(authorizationHeader: string | null, channel: Channel): Promise<BearerAuthResult> {
  if (!authorizationHeader?.startsWith("Bearer ")) return { ok: false, error: "missing_token" };
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) return { ok: false, error: "missing_token" };

  if (!token.startsWith("sage_pat_")) return { ok: false, error: "unsupported_token_format" };

  const hash = hashAssistantToken(token);
  const { rows: patRows } = await queryPrivileged<{ grant_id: string }>(
    "select grant_id from sage.personal_access_tokens where token_hash = $1",
    [hash]
  );
  if (patRows.length === 0) return { ok: false, error: "invalid_token" };

  const { rows: grantRows } = await queryPrivileged<{
    id: string; user_id: string; display_name: string; client_id: string;
    scopes: Partial<Record<Module, ScopeLevel>>; expires_at: string | null; status: string;
  }>(
    "select id, user_id, display_name, client_id, scopes, expires_at, status from sage.connected_apps where id = $1",
    [patRows[0].grant_id]
  );
  const grant = grantRows[0];
  if (!grant || grant.status !== "active") return { ok: false, error: "revoked" };
  if (grant.expires_at && new Date(grant.expires_at) < new Date()) return { ok: false, error: "expired" };

  // Fire-and-forget — a failed last_used_at touch shouldn't fail the request.
  queryPrivileged("update sage.connected_apps set last_used_at = now() where id = $1", [grant.id]).catch(() => {});

  const scopes = Object.fromEntries(ALL_MODULES.map((m) => [m, grant.scopes[m] ?? "none"])) as Record<Module, ScopeLevel>;

  return {
    ok: true,
    principal: {
      channel, userId: grant.user_id, scopes,
      grantId: grant.id, clientId: grant.client_id, clientName: grant.display_name,
      requestId: randomUUID(),
    },
  };
}
