import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode, refreshAccessToken } from "@/lib/server/auth/oauth-flow";

export const maxDuration = 15;

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return (await req.json()) as Record<string, string>;
  const form = await req.formData();
  return Object.fromEntries(form.entries()) as Record<string, string>;
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await parseBody(req);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const grantType = body.grant_type;

  if (grantType === "authorization_code") {
    if (!body.code || !body.client_id || !body.redirect_uri || !body.code_verifier) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const result = await exchangeAuthorizationCode({
      code: body.code,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
      resource: body.resource,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }

  if (grantType === "refresh_token") {
    if (!body.refresh_token || !body.client_id) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const result = await refreshAccessToken({ refreshToken: body.refresh_token, clientId: body.client_id, resource: body.resource });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
}
