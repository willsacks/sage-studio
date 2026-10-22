import { NextResponse } from "next/server";
import { ISSUER } from "@/lib/server/auth/oauth-jwt";
import { ALL_MODULES } from "@/lib/server/auth/principal";

const WRITABLE_MODULES = new Set(["todos", "knowledge", "time_tracking", "sites", "finance", "courses"]);

/** RFC 9728 Protected Resource Metadata — lets a client discover which
 * authorization server(s) issue tokens this resource (our REST API and
 * MCP server, same resource identifier) will accept, and (via
 * scopes_supported) which scope strings are worth requesting at
 * /oauth/authorize. A real client (Grok) connected without this field
 * and had nothing to ask for, so /oauth/authorize defaults an
 * unqualified request to read+write and lets the consent screen's own
 * toggles be the real gate — but a client that reads this list and asks
 * explicitly still gets the more standard, spec-compliant path. */
export async function GET() {
  const scopesSupported = ALL_MODULES.flatMap((m) => (WRITABLE_MODULES.has(m) ? [m, `${m}:write`] : [m]));
  return NextResponse.json(
    {
      resource: ISSUER,
      authorization_servers: [ISSUER],
      bearer_methods_supported: ["header"],
      scopes_supported: scopesSupported,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
