import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { encryptQboToken, decryptQboToken } from "@/lib/crypto";
import { getQboOAuthClient } from "@/lib/finance/qbo-client";

const REFRESH_BUFFER_MS = 60_000;

/**
 * Returns a valid access token for a QuickBooks connection, refreshing and
 * persisting the rotated tokens first if the current one is expired or
 * about to expire. This is the single place token refresh happens — every
 * QuickBooks API call site goes through here rather than reading
 * access_token_encrypted directly, mirroring the "one writer" discipline
 * already used for the ledger (postJournalEntry).
 */
export async function getValidQboAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  connectionId: string
): Promise<{ accessToken: string; realmId: string; environment: "sandbox" | "production" } | { error: string }> {
  const { data: connection, error } = await supabase
    .from("qbo_connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  if (error || !connection) return { error: error?.message ?? "QuickBooks connection not found" };

  if (connection.status !== "active") return { error: `QuickBooks connection is ${connection.status}` };

  const expiresAt = new Date(connection.access_token_expires_at).getTime();
  if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
    return {
      accessToken: decryptQboToken(connection.access_token_encrypted),
      realmId: connection.qbo_realm_id,
      environment: connection.environment,
    };
  }

  const refreshTokenExpiresAt = new Date(connection.refresh_token_expires_at).getTime();
  if (Date.now() >= refreshTokenExpiresAt) {
    await supabase.from("qbo_connections").update({ status: "error" }).eq("id", connectionId);
    return { error: "QuickBooks connection expired — reconnect required" };
  }

  const refreshToken = decryptQboToken(connection.refresh_token_encrypted);
  const oauthClient = getQboOAuthClient();
  let authResponse;
  try {
    authResponse = await oauthClient.refreshUsingToken(refreshToken);
  } catch (err) {
    // intuit_tid identifies this specific request on Intuit's side — worth
    // capturing on every OAuth failure so a support ticket can reference
    // the exact request, not just our own description of what happened.
    const intuitTid = (err as { intuit_tid?: string; authResponse?: { getIntuitTid?: () => string } } | undefined)?.intuit_tid
      ?? (err as { authResponse?: { getIntuitTid?: () => string } } | undefined)?.authResponse?.getIntuitTid?.();
    await supabase.from("qbo_connections").update({ status: "error" }).eq("id", connectionId);
    // invalid_grant specifically means the refresh token itself was
    // rejected (revoked, already used, or the underlying authorization was
    // withdrawn) — distinct from a transient network failure, and the one
    // case where retrying with the same token can never succeed. Surfaced
    // with a distinct message so the UI's "reconnect" prompt is accurate
    // rather than implying a temporary glitch.
    const code = (err as { code?: string } | undefined)?.code;
    const tidSuffix = intuitTid ? ` (intuit_tid: ${intuitTid})` : "";
    if (code === "invalid_grant") {
      return { error: `QuickBooks revoked this connection's access — reconnect required${tidSuffix}` };
    }
    return { error: `${err instanceof Error ? err.message : "Failed to refresh QuickBooks token"}${tidSuffix}` };
  }

  const token = authResponse.getToken();
  const now = Date.now();
  await supabase
    .from("qbo_connections")
    .update({
      access_token_encrypted: encryptQboToken(token.access_token!),
      refresh_token_encrypted: encryptQboToken(token.refresh_token!),
      access_token_expires_at: new Date(now + (token.expires_in ?? 3600) * 1000).toISOString(),
      refresh_token_expires_at: new Date(now + (token.x_refresh_token_expires_in ?? 8_640_000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return { accessToken: token.access_token!, realmId: connection.qbo_realm_id, environment: connection.environment };
}
