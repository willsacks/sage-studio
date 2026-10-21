import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshTokenFamily } from "@/lib/server/auth/oauth-flow";
import { verifyAccessToken, ISSUER } from "@/lib/server/auth/oauth-jwt";
import { revokeAccessTokenJti } from "@/lib/server/auth/oauth-flow";

export const maxDuration = 15;

/** RFC 7009. Always returns 200 regardless of whether the token was
 * found/valid — per spec, a client can't distinguish an unknown token
 * from a successfully revoked one. */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, string>;
  try {
    body = contentType.includes("application/json") ? await req.json() : Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const token = body.token;
  const clientId = body.client_id;
  if (!token || !clientId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  if (body.token_type_hint === "access_token" || token.split(".").length === 3) {
    const verified = await verifyAccessToken(token, ISSUER);
    if (verified) await revokeAccessTokenJti(verified.jti, new Date(Date.now() + 15 * 60 * 1000));
  } else {
    await revokeRefreshTokenFamily(token, clientId);
  }

  return new NextResponse(null, { status: 200 });
}
