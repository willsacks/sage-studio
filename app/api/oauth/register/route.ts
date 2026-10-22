import { NextRequest, NextResponse } from "next/server";
import { registerDcrClient } from "@/lib/server/auth/oauth-dcr";

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }

  const result = await registerDcrClient({
    client_name: body.client_name as string | undefined,
    client_uri: body.client_uri as string | undefined,
    redirect_uris: body.redirect_uris as string[],
    token_endpoint_auth_method: body.token_endpoint_auth_method as string | undefined,
  });

  if ("error" in result) return NextResponse.json({ error: "invalid_client_metadata", error_description: result.error }, { status: 400 });

  // RFC 7591 optional metadata fields (client_uri, etc.) must be omitted
  // when absent, not sent as null — at least one real client (Grok)
  // rejects a null value for an optional string field outright.
  const responseBody = Object.fromEntries(Object.entries(result).filter(([, v]) => v !== null && v !== undefined));
  return NextResponse.json(responseBody, { status: 201, headers: { "Cache-Control": "no-store" } });
}
