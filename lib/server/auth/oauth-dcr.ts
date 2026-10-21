import { randomUUID, createHash } from "crypto";
import { queryPrivileged } from "@/lib/server/db/privileged";
import { writeOauthAuditLog } from "@/lib/server/audit/write";

export interface DcrRequest {
  client_name?: string;
  client_uri?: string;
  redirect_uris: string[];
  token_endpoint_auth_method?: string;
}

export interface DcrResult {
  client_id: string;
  client_name: string;
  client_uri: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at: number;
}

// Pseudo-schemes a browser could execute or navigate to in a way that
// isn't "deliver this URL to another app" — never valid as an OAuth
// redirect regardless of the custom-URI-scheme allowance below.
const DANGEROUS_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "about:", "file:"]);

function isValidRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (DANGEROUS_SCHEMES.has(parsed.protocol)) return false;
  if (parsed.protocol === "https:") return true;
  // RFC 8252 native-app loopback redirects and custom URI schemes (e.g.
  // Cursor's own scheme) — both are fine since they can't be hijacked the
  // way an arbitrary http(s) redirect host could be.
  if (parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]" || parsed.hostname === "localhost")) return true;
  if (parsed.protocol !== "http:") return true;
  return false;
}

/** RFC 7591 Dynamic Client Registration. No auth required to register
 * (anyone can mint a client_id) — that's standard DCR; what actually
 * gates access is the consent screen + per-resource scope capping, not
 * client registration itself. `token_endpoint_auth_method` is forced to
 * "none" (public client, PKCE-only) since nothing here issues confidential
 * client secrets yet — every client we expect (Claude, ChatGPT, Cursor)
 * is a public client anyway. */
export async function registerDcrClient(body: DcrRequest): Promise<DcrResult | { error: string }> {
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (redirectUris.length === 0) return { error: "redirect_uris is required and must be non-empty" };
  for (const uri of redirectUris) {
    if (!isValidRedirectUri(uri)) return { error: `invalid redirect_uri: ${uri}` };
  }

  const clientId = randomUUID();
  const clientName = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim() : "Unnamed client";
  const clientUri = typeof body.client_uri === "string" ? body.client_uri : null;

  await queryPrivileged(
    `insert into sage.oauth_clients (id, kind, client_name, client_uri, redirect_uris, token_endpoint_auth_method, verified, status)
     values ($1, 'dcr', $2, $3, $4, 'none', false, 'active')`,
    [clientId, clientName, clientUri, redirectUris]
  );
  await writeOauthAuditLog({ operation: "oauth.clientRegistered", status: "ok", clientId });

  return {
    client_id: clientId,
    client_name: clientName,
    client_uri: clientUri,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
