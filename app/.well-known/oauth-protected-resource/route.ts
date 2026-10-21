import { NextResponse } from "next/server";
import { ISSUER } from "@/lib/server/auth/oauth-jwt";

/** RFC 9728 Protected Resource Metadata — lets a client discover which
 * authorization server(s) issue tokens this resource (our REST API and
 * MCP server, same resource identifier) will accept. */
export async function GET() {
  return NextResponse.json(
    {
      resource: ISSUER,
      authorization_servers: [ISSUER],
      bearer_methods_supported: ["header"],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
