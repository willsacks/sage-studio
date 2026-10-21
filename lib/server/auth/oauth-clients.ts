import { queryPrivileged } from "@/lib/server/db/privileged";

export interface OAuthClient {
  id: string;
  kind: "cimd" | "dcr" | "pat" | "static";
  clientName: string;
  clientUri: string | null;
  displayHost: string | null;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
  verified: boolean;
  status: "active" | "disabled";
}

function rowToClient(r: Record<string, unknown>): OAuthClient {
  return {
    id: r.id as string,
    kind: r.kind as OAuthClient["kind"],
    clientName: r.client_name as string,
    clientUri: (r.client_uri as string) ?? null,
    displayHost: (r.display_host as string) ?? null,
    redirectUris: (r.redirect_uris as string[]) ?? [],
    tokenEndpointAuthMethod: r.token_endpoint_auth_method as string,
    verified: r.verified as boolean,
    status: r.status as OAuthClient["status"],
  };
}

/** Blocks requests to private/loopback/link-local/metadata-endpoint
 * addresses before we ever open a socket — resolving DNS ourselves and
 * checking the IP, not just string-matching the hostname (which a DNS
 * rebind could bypass). Also blocks the Cursor/AWS metadata IP
 * explicitly since it's not in any RFC1918 block. */
async function assertPublicHttpsUrl(urlStr: string): Promise<URL> {
  const url = new URL(urlStr);
  if (url.protocol !== "https:") throw new Error("client_id must be an https URL");
  const { lookup } = await import("node:dns/promises");
  const { address } = await lookup(url.hostname);
  const parts = address.split(".").map(Number);
  const isPrivate =
    address === "127.0.0.1" ||
    address === "169.254.169.254" ||
    address.startsWith("::1") ||
    (parts.length === 4 &&
      (parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        parts[0] === 127 ||
        (parts[0] === 169 && parts[1] === 254)));
  if (isPrivate) throw new Error("client_id resolves to a non-public address");
  return url;
}

const CIMD_FETCH_TIMEOUT_MS = 4000;
const CIMD_MAX_BYTES = 32 * 1024;

/** Client ID Metadata Documents — the client_id IS a URL; fetch the JSON
 * document it points to (RFC draft, as used by Claude/ChatGPT remote
 * MCP connectors) and cache it in oauth_clients so we don't refetch on
 * every authorize request. SSRF guards: https-only, public IP only,
 * timeout, size cap, no redirects followed blindly (manual + re-checked). */
export async function resolveCimdClient(clientIdUrl: string): Promise<OAuthClient> {
  const existing = await queryPrivileged(
    `select * from sage.oauth_clients where id = $1 and kind = 'cimd' and status = 'active'
       and (metadata_expires_at is null or metadata_expires_at > now())`,
    [clientIdUrl]
  );
  if (existing.rows.length > 0) return rowToClient(existing.rows[0]);

  const url = await assertPublicHttpsUrl(clientIdUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CIMD_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timeout);
  }
  if (res.status >= 300 && res.status < 400) {
    throw new Error("client_id document must not redirect");
  }
  if (!res.ok) throw new Error(`client_id document fetch failed: ${res.status}`);
  const text = await res.text();
  if (text.length > CIMD_MAX_BYTES) throw new Error("client_id document too large");
  const doc = JSON.parse(text);

  if (doc.client_id !== clientIdUrl) throw new Error("client_id document's client_id field must match the URL it was fetched from");
  const redirectUris: string[] = Array.isArray(doc.redirect_uris) ? doc.redirect_uris : [];
  if (redirectUris.length === 0) throw new Error("client_id document has no redirect_uris");
  for (const r of redirectUris) {
    const ru = new URL(r);
    if (ru.protocol !== "https:" && !(ru.protocol === "http:" && (ru.hostname === "127.0.0.1" || ru.hostname === "localhost"))) {
      throw new Error(`redirect_uri must be https (got ${r})`);
    }
  }

  const clientName = typeof doc.client_name === "string" ? doc.client_name : url.hostname;

  await queryPrivileged(
    `insert into sage.oauth_clients (id, kind, client_name, client_uri, display_host, redirect_uris, token_endpoint_auth_method, metadata, metadata_expires_at, verified, status)
     values ($1, 'cimd', $2, $3, $4, $5, 'none', $6, now() + interval '1 hour', false, 'active')
     on conflict (id) do update set client_name = excluded.client_name, redirect_uris = excluded.redirect_uris,
       metadata = excluded.metadata, metadata_expires_at = excluded.metadata_expires_at, display_host = excluded.display_host`,
    [clientIdUrl, clientName, url.origin, url.hostname, redirectUris, JSON.stringify(doc)]
  );

  return {
    id: clientIdUrl,
    kind: "cimd",
    clientName,
    clientUri: url.origin,
    displayHost: url.hostname,
    redirectUris,
    tokenEndpointAuthMethod: "none",
    verified: false,
    status: "active",
  };
}

export async function getClientById(clientId: string): Promise<OAuthClient | null> {
  const { rows } = await queryPrivileged(`select * from sage.oauth_clients where id = $1 and status = 'active'`, [clientId]);
  if (rows.length === 0) return null;
  return rowToClient(rows[0]);
}

/** Resolves a client_id for /oauth/authorize: a URL means CIMD (fetch +
 * cache), otherwise it must already exist (registered via DCR, or a PAT's
 * static_pat row — though PATs never go through /oauth/authorize). */
export async function resolveClientForAuthorize(clientId: string): Promise<OAuthClient> {
  if (clientId.startsWith("https://")) return resolveCimdClient(clientId);
  const client = await getClientById(clientId);
  if (!client) throw new Error("Unknown client_id");
  return client;
}
