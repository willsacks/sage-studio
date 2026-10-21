import { randomBytes } from "crypto";
import { hashAssistantToken } from "@/lib/crypto";
import { queryPrivileged } from "@/lib/server/db/privileged";
import { withRlsWrite } from "@/lib/server/db/with-rls";
import type { Module, ScopeLevel } from "@/lib/server/auth/principal";

const STATIC_PAT_CLIENT_ID = "static_pat";

/** PATs aren't tied to a real OAuth client (no CIMD/DCR identity) — this
 * row exists purely to satisfy connected_apps.client_id's foreign key. */
async function ensureStaticPatClient(): Promise<void> {
  await queryPrivileged(
    `insert into sage.oauth_clients (id, kind, client_name, token_endpoint_auth_method, verified, status)
     values ($1, 'static', 'Personal access token', 'none', true, 'active')
     on conflict (id) do nothing`,
    [STATIC_PAT_CLIENT_ID]
  );
}

/** Creates a connection + a personal access token for it, as the given
 * user. The connected_apps insert runs through withRlsWrite (as the user,
 * via auth.uid()) so the normal p_insert RLS policy is what actually
 * authorizes it — this function doesn't bypass that, it just supplies
 * the claims that let auth.uid() resolve for a non-cookie-session
 * caller. The raw token is returned exactly once; only its hash is ever
 * stored (lib/crypto.ts's hashAssistantToken). */
export async function createPersonalAccessToken(
  userId: string,
  displayName: string,
  scopes: Partial<Record<Module, ScopeLevel>>
): Promise<{ token: string; grantId: string } | { error: string }> {
  await ensureStaticPatClient();

  const grantId = await withRlsWrite(
    { channel: "web", userId, scopes: {} as Record<Module, ScopeLevel>, requestId: "pat-create" },
    async (db) => {
      const { rows } = await db.query(
        `insert into sage.connected_apps (user_id, client_id, kind, display_name, scopes)
         values ($1, $2, 'pat', $3, $4) returning id`,
        [userId, STATIC_PAT_CLIENT_ID, displayName, JSON.stringify(scopes)]
      );
      return rows[0].id as string;
    }
  ).catch((err: unknown) => {
    console.error("[createPersonalAccessToken] insert failed", err);
    return null;
  });

  if (!grantId) return { error: "Failed to create connection" };

  const raw = `sage_pat_${randomBytes(30).toString("base64url")}`;
  const hash = hashAssistantToken(raw);
  await queryPrivileged(
    "insert into sage.personal_access_tokens (token_hash, grant_id, prefix) values ($1, $2, $3)",
    [hash, grantId, raw.slice(0, 16)]
  );

  return { token: raw, grantId };
}
