import { NextResponse } from "next/server";
import { ISSUER } from "@/lib/server/auth/oauth-jwt";

/** RFC 8414 Authorization Server Metadata. */
export async function GET() {
  return NextResponse.json(
    {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/oauth/authorize`,
      token_endpoint: `${ISSUER}/api/oauth/token`,
      registration_endpoint: `${ISSUER}/api/oauth/register`,
      revocation_endpoint: `${ISSUER}/api/oauth/revoke`,
      jwks_uri: `${ISSUER}/api/oauth/jwks`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["todos", "knowledge", "time_tracking", "sites", "finance", "courses"],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
