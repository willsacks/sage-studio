import { importJWK, SignJWT, jwtVerify, type JWK } from "jose";
import type { Module, ScopeLevel } from "@/lib/server/auth/principal";

/** Single signing key for now (no rotation yet — JWKS still serves it as
 * an array of one, which is the correct shape for a future second key
 * during rotation). ES256 per the plan's "at+jwt" access-token design. */
function getSigningJwk(): JWK {
  const raw = process.env.SAGE_OAUTH_SIGNING_KEY;
  if (!raw) throw new Error("SAGE_OAUTH_SIGNING_KEY is not set.");
  return JSON.parse(raw) as JWK;
}

export const ISSUER = process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 10;

export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const jwk = getSigningJwk();
  // Strip the private component rather than round-tripping through
  // importJWK/exportJWK — jose's WebCrypto import marks EC private keys
  // non-extractable, so exportJWK on the imported key throws.
  const { d, ...pub } = jwk;
  void d;
  return { keys: [pub] };
}

export interface AccessTokenClaims {
  sub: string;
  gid: string;
  client_id: string;
  scopes: Partial<Record<Module, ScopeLevel>>;
  resource: string;
  jti: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }> {
  const jwk = getSigningJwk();
  const key = await importJWK(jwk, "ES256");
  const token = await new SignJWT({
    scopes: claims.scopes,
    gid: claims.gid,
    client_id: claims.client_id,
  })
    .setProtectedHeader({ alg: "ES256", typ: "at+jwt", kid: jwk.kid })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(claims.resource)
    .setJti(claims.jti)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export interface VerifiedAccessToken {
  sub: string;
  gid: string;
  clientId: string;
  scopes: Partial<Record<Module, ScopeLevel>>;
  jti: string;
}

export async function verifyAccessToken(token: string, resource: string): Promise<VerifiedAccessToken | null> {
  try {
    const { d, ...pubJwk } = getSigningJwk();
    void d;
    const key = await importJWK(pubJwk, "ES256");
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: resource });
    if (!payload.sub || !payload.jti) return null;
    return {
      sub: payload.sub,
      gid: (payload.gid as string) ?? "",
      clientId: (payload.client_id as string) ?? "",
      scopes: (payload.scopes as Partial<Record<Module, ScopeLevel>>) ?? {},
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}
