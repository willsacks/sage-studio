import { createHash } from "crypto";

/** PKCE S256 only — OAuth 2.1 drops support for "plain" and for public
 * clients without PKCE at all, so there's no fallback path here. */
export function verifyCodeVerifier(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}
