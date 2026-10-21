import { randomBytes, randomUUID } from "crypto";
import { hashAssistantToken } from "@/lib/crypto";
import { queryPrivileged } from "@/lib/server/db/privileged";
import { withRlsWrite } from "@/lib/server/db/with-rls";
import { verifyCodeVerifier } from "@/lib/server/auth/pkce";
import { signAccessToken, ISSUER } from "@/lib/server/auth/oauth-jwt";
import { writeOauthAuditLog } from "@/lib/server/audit/write";
import { ALL_MODULES, type Module, type ScopeLevel } from "@/lib/server/auth/principal";

const AUTH_CODE_TTL_SECONDS = 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;

export interface AuthorizationRequestInput {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  resource: string;
  scopesRequested: string[];
}

export async function createAuthorizationRequest(input: AuthorizationRequestInput): Promise<string> {
  const { rows } = await queryPrivileged(
    `insert into sage.oauth_authorization_requests (client_id, redirect_uri, state, code_challenge, resource, scopes_requested)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [input.clientId, input.redirectUri, input.state, input.codeChallenge, input.resource, input.scopesRequested]
  );
  return rows[0].id as string;
}

export interface AuthorizationRequestRow {
  id: string;
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  resource: string;
  scopesRequested: string[];
}

export async function getPendingAuthorizationRequest(id: string): Promise<AuthorizationRequestRow | null> {
  const { rows } = await queryPrivileged(
    `select * from sage.oauth_authorization_requests where id = $1 and consumed_at is null and expires_at > now()`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    clientId: r.client_id as string,
    redirectUri: r.redirect_uri as string,
    state: (r.state as string) ?? null,
    codeChallenge: r.code_challenge as string,
    resource: r.resource as string,
    scopesRequested: r.scopes_requested as string[],
  };
}

/** User approved the consent screen. Creates the connected_apps grant (as
 * the user, via withRlsWrite so the real p_insert policy authorizes it),
 * mints a one-time authorization code, and marks the request consumed —
 * all inside one privileged transaction's worth of statements (the grant
 * insert itself still goes through the user's own RLS context). */
export async function approveAuthorizationRequest(
  requestId: string,
  userId: string,
  grantedScopes: Partial<Record<Module, ScopeLevel>>,
  displayName: string
): Promise<{ redirectUri: string; code: string; state: string | null } | { error: string }> {
  const request = await getPendingAuthorizationRequest(requestId);
  if (!request) return { error: "This authorization request has expired. Please try connecting again." };

  const fullScopes = Object.fromEntries(ALL_MODULES.map((m) => [m, grantedScopes[m] ?? "none"])) as Record<Module, ScopeLevel>;

  const grantId = await withRlsWrite(
    { channel: "web", userId, scopes: {} as Record<Module, ScopeLevel>, requestId: "oauth-consent" },
    async (db) => {
      const { rows } = await db.query(
        `insert into sage.connected_apps (user_id, client_id, kind, display_name, scopes)
         values ($1, $2, 'oauth', $3, $4) returning id`,
        [userId, request.clientId, displayName, JSON.stringify(fullScopes)]
      );
      return rows[0].id as string;
    }
  );

  const rawCode = randomBytes(32).toString("base64url");
  const codeHash = hashAssistantToken(rawCode);

  await queryPrivileged(
    `insert into sage.oauth_authorization_codes (code_hash, request_id, grant_id, client_id, redirect_uri, code_challenge, resource, user_id, scopes, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + interval '${AUTH_CODE_TTL_SECONDS} seconds')`,
    [codeHash, request.id, grantId, request.clientId, request.redirectUri, request.codeChallenge, request.resource, userId, JSON.stringify(fullScopes)]
  );
  await queryPrivileged(`update sage.oauth_authorization_requests set consumed_at = now(), user_id = $1 where id = $2`, [userId, request.id]);

  return { redirectUri: request.redirectUri, code: rawCode, state: request.state };
}

export async function denyAuthorizationRequest(requestId: string): Promise<{ redirectUri: string; state: string | null } | { error: string }> {
  const request = await getPendingAuthorizationRequest(requestId);
  if (!request) return { error: "This authorization request has expired." };
  await queryPrivileged(`update sage.oauth_authorization_requests set consumed_at = now() where id = $1`, [request.id]);
  return { redirectUri: request.redirectUri, state: request.state };
}

export interface TokenResult {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

async function issueTokenPair(
  grantId: string,
  userId: string,
  clientId: string,
  resource: string,
  scopes: Partial<Record<Module, ScopeLevel>>,
  familyId: string,
  operation: "oauth.tokenIssued" | "oauth.tokenRefreshed"
): Promise<TokenResult> {
  const jti = randomUUID();
  const { token, expiresIn } = await signAccessToken({ sub: userId, gid: grantId, client_id: clientId, scopes, resource, jti });

  const rawRefresh = `sage_rt_${randomBytes(32).toString("base64url")}`;
  const refreshHash = hashAssistantToken(rawRefresh);
  await queryPrivileged(
    `insert into sage.oauth_refresh_tokens (token_hash, grant_id, client_id, family_id, resource, scopes, expires_at)
     values ($1, $2, $3, $4, $5, $6, now() + interval '${REFRESH_TOKEN_TTL_SECONDS} seconds')`,
    [refreshHash, grantId, clientId, familyId, resource, JSON.stringify(scopes)]
  );
  await writeOauthAuditLog({ operation, status: "ok", userId, clientId, grantId });

  const grantedModules = ALL_MODULES.filter((m) => (scopes[m] ?? "none") !== "none");
  return { access_token: token, token_type: "Bearer", expires_in: expiresIn, refresh_token: rawRefresh, scope: grantedModules.join(" ") };
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource?: string;
}): Promise<TokenResult | { error: string }> {
  const codeHash = hashAssistantToken(params.code);
  const { rows } = await queryPrivileged(`select * from sage.oauth_authorization_codes where code_hash = $1`, [codeHash]);
  if (rows.length === 0) return { error: "invalid_grant" };
  const row = rows[0];

  if (row.consumed_at) {
    // Reuse of an auth code is a strong signal of interception — kill the grant outright.
    await queryPrivileged(`update sage.connected_apps set status = 'revoked', revoke_reason = 'authorization_code_reuse_detected' where id = $1`, [row.grant_id]);
    await writeOauthAuditLog({ operation: "oauth.authCodeReuseDetected", status: "denied", userId: row.user_id as string, clientId: row.client_id as string, grantId: row.grant_id as string, errorCode: "authorization_code_reuse_detected" });
    return { error: "invalid_grant" };
  }
  if (new Date(row.expires_at as string) < new Date()) return { error: "invalid_grant" };
  if (row.client_id !== params.clientId) return { error: "invalid_grant" };
  if (row.redirect_uri !== params.redirectUri) return { error: "invalid_grant" };
  if (params.resource && row.resource !== params.resource) return { error: "invalid_target" };
  if (!verifyCodeVerifier(params.codeVerifier, row.code_challenge as string)) return { error: "invalid_grant" };

  await queryPrivileged(`update sage.oauth_authorization_codes set consumed_at = now() where code_hash = $1`, [codeHash]);

  const familyId = randomUUID();
  return issueTokenPair(row.grant_id as string, row.user_id as string, row.client_id as string, row.resource as string, row.scopes as Partial<Record<Module, ScopeLevel>>, familyId, "oauth.tokenIssued");
}

export async function refreshAccessToken(params: { refreshToken: string; clientId: string; resource?: string }): Promise<TokenResult | { error: string }> {
  const hash = hashAssistantToken(params.refreshToken);
  const { rows } = await queryPrivileged(`select * from sage.oauth_refresh_tokens where token_hash = $1`, [hash]);
  if (rows.length === 0) return { error: "invalid_grant" };
  const row = rows[0];

  if (row.client_id !== params.clientId) return { error: "invalid_grant" };
  if (new Date(row.expires_at as string) < new Date()) return { error: "invalid_grant" };
  if (params.resource && params.resource !== ISSUER) return { error: "invalid_target" };

  if (row.revoked_at || row.rotated_at) {
    // Reuse of an already-rotated/revoked refresh token — treat as theft,
    // kill the whole token family so a stolen token can't keep refreshing.
    await queryPrivileged(`update sage.oauth_refresh_tokens set revoked_at = now() where family_id = $1 and revoked_at is null`, [row.family_id]);
    await queryPrivileged(`update sage.connected_apps set status = 'revoked', revoke_reason = 'refresh_token_reuse_detected' where id = $1`, [row.grant_id]);
    await writeOauthAuditLog({ operation: "oauth.refreshTokenReuseDetected", status: "denied", clientId: row.client_id as string, grantId: row.grant_id as string, errorCode: "refresh_token_reuse_detected" });
    return { error: "invalid_grant" };
  }

  const { rows: grantRows } = await queryPrivileged(`select * from sage.connected_apps where id = $1 and status = 'active'`, [row.grant_id]);
  if (grantRows.length === 0) return { error: "invalid_grant" };
  const grant = grantRows[0];

  await queryPrivileged(`update sage.oauth_refresh_tokens set rotated_at = now(), last_used_at = now() where token_hash = $1`, [hash]);
  await queryPrivileged(`update sage.connected_apps set last_used_at = now() where id = $1`, [row.grant_id]);

  const resource = params.resource ?? (row.resource as string);
  return issueTokenPair(row.grant_id as string, grant.user_id as string, row.client_id as string, resource, row.scopes as Partial<Record<Module, ScopeLevel>>, row.family_id as string, "oauth.tokenRefreshed");
}

export async function revokeRefreshTokenFamily(refreshToken: string, clientId: string): Promise<void> {
  const hash = hashAssistantToken(refreshToken);
  const { rows } = await queryPrivileged(`select family_id, client_id from sage.oauth_refresh_tokens where token_hash = $1`, [hash]);
  if (rows.length === 0 || rows[0].client_id !== clientId) return;
  await queryPrivileged(`update sage.oauth_refresh_tokens set revoked_at = now() where family_id = $1 and revoked_at is null`, [rows[0].family_id]);
}

export async function revokeAccessTokenJti(jti: string, expiresAt: Date): Promise<void> {
  await queryPrivileged(`insert into sage.oauth_revoked_jti (jti, expires_at) values ($1, $2) on conflict (jti) do nothing`, [jti, expiresAt.toISOString()]);
}

export async function isJtiRevoked(jti: string): Promise<boolean> {
  const { rows } = await queryPrivileged(`select 1 from sage.oauth_revoked_jti where jti = $1 and expires_at > now()`, [jti]);
  return rows.length > 0;
}

export { ISSUER };
