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
  return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
}
