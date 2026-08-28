import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlaidClient } from "@/lib/finance/plaid-client";
import { syncBankConnection } from "@/lib/finance/plaid-sync";

// Unauthenticated by definition (Plaid calls this directly) — integrity
// comes entirely from verifying the JWT in the Plaid-Verification header,
// not from a session. Plaid uses per-key-id JWTs (ES256), not a static
// HMAC secret like Stripe's webhook signing, so verification means:
// 1. read the kid out of the JWT header (unverified at this point)
// 2. fetch that specific verification key from Plaid
// 3. verify the JWT's signature against that key
// 4. confirm the JWT's request_body_sha256 claim matches this exact body
async function verifyPlaidWebhook(rawBody: string, verificationHeader: string | null): Promise<boolean> {
  if (!verificationHeader) return false;
  try {
    const { kid } = decodeProtectedHeader(verificationHeader);
    if (!kid) return false;

    const plaid = getPlaidClient();
    const keyResponse = await plaid.webhookVerificationKeyGet({ key_id: kid });
    const jwk = keyResponse.data.key;

    const key = await importJWK({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, alg: jwk.alg }, jwk.alg);
    const { payload } = await jwtVerify(verificationHeader, key);

    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    return payload.request_body_sha256 === bodyHash;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verified = await verifyPlaidWebhook(rawBody, request.headers.get("plaid-verification"));
  if (!verified) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });

  const payload = JSON.parse(rawBody);
  if (payload.webhook_type !== "TRANSACTIONS" || payload.webhook_code !== "SYNC_UPDATES_AVAILABLE") {
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("id")
    .eq("plaid_item_id", payload.item_id)
    .maybeSingle();
  if (!connection) return NextResponse.json({ received: true });

  await syncBankConnection(supabase, connection.id);
  return NextResponse.json({ received: true });
}
