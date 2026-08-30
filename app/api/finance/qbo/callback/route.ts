import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getQboOAuthClient } from "@/lib/finance/qbo-client";
import { parseQboState } from "@/lib/finance/qbo-state";
import { encryptQboToken } from "@/lib/crypto";
import { commitCreateEntity } from "@/lib/finance/import-commit";
import { triggerImportRun } from "@/lib/finance/trigger-import";

// Needs to outlive the default function timeout on some Vercel plans while
// its after() callback waits (up to 8s) for the import runner to accept
// the trigger request.
export const maxDuration = 30;

/** OAuth is a full-page redirect, not a modal (unlike Plaid Link) — Intuit
 * sends the user's browser here directly with ?code&realmId&state. Runs on
 * the admin client (service role) since there's no guarantee the original
 * session cookie survives the round trip through Intuit's domain; the
 * signed `state` param is what proves which user/intended-entity this
 * callback belongs to, not the request's own cookies. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";

  if (errorParam) {
    return NextResponse.redirect(`${redirectBase}/finances?qboError=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !realmId || !stateParam) {
    return NextResponse.redirect(`${redirectBase}/finances?qboError=missing_params`);
  }

  const state = parseQboState(stateParam);
  if (!state) {
    return NextResponse.redirect(`${redirectBase}/finances?qboError=invalid_state`);
  }

  const oauthClient = getQboOAuthClient();
  let authResponse;
  try {
    authResponse = await oauthClient.createToken(request.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    return NextResponse.redirect(`${redirectBase}/finances?qboError=${encodeURIComponent(message)}`);
  }
  const token = authResponse.getToken();
  if (!token.access_token || !token.refresh_token) {
    return NextResponse.redirect(`${redirectBase}/finances?qboError=no_token`);
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const environment = process.env.QBO_ENVIRONMENT === "production" ? "production" : "sandbox";

  // Reconnect mode: re-authenticate an EXISTING entity's connection (e.g.
  // after a refresh token expired or was revoked) — never creates a new
  // entity or a new import job, just refreshes the stored tokens/status.
  if (state.mode === "reconnect") {
    const { error: reconnectError } = await supabase
      .from("qbo_connections")
      .update({
        qbo_realm_id: realmId,
        access_token_encrypted: encryptQboToken(token.access_token),
        refresh_token_encrypted: encryptQboToken(token.refresh_token),
        access_token_expires_at: new Date(now + (token.expires_in ?? 3600) * 1000).toISOString(),
        refresh_token_expires_at: new Date(now + (token.x_refresh_token_expires_in ?? 8_640_000) * 1000).toISOString(),
        environment,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("entity_id", state.entityId)
      .eq("owner_id", state.userId);
    if (reconnectError) {
      return NextResponse.redirect(`${redirectBase}/finances?qboError=${encodeURIComponent(reconnectError.message)}`);
    }
    return NextResponse.redirect(`${redirectBase}/finances?entity=${state.entityId}&qboReconnected=1`);
  }

  const created = await commitCreateEntity(supabase, {
    ownerId: state.userId,
    name: `${state.intendedEntityName} (from QuickBooks)`,
    entityType: state.entityType,
  });
  if ("error" in created) {
    return NextResponse.redirect(`${redirectBase}/finances?qboError=${encodeURIComponent(created.error)}`);
  }

  const { error: connectionError } = await supabase.from("qbo_connections").insert({
    entity_id: created.entityId,
    owner_id: state.userId,
    qbo_realm_id: realmId,
    access_token_encrypted: encryptQboToken(token.access_token),
    refresh_token_encrypted: encryptQboToken(token.refresh_token),
    access_token_expires_at: new Date(now + (token.expires_in ?? 3600) * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + (token.x_refresh_token_expires_in ?? 8_640_000) * 1000).toISOString(),
    environment,
  });
  if (connectionError) {
    return NextResponse.redirect(`${redirectBase}/finances?qboError=${encodeURIComponent(connectionError.message)}`);
  }

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({ owner_id: state.userId, entity_id: created.entityId, source: "quickbooks", status: "pending" })
    .select("id")
    .single();
  if (jobError || !job) {
    return NextResponse.redirect(`${redirectBase}/finances?qboError=${encodeURIComponent(jobError?.message ?? "job_creation_failed")}`);
  }

  // Kicks off the chunked/resumable import runner via after() rather than a
  // bare fire-and-forget fetch — see trigger-import.ts for why the naive
  // version is unreliable on serverless. The redirect below still returns
  // immediately; the runner (and its own self-re-invocations if the pull
  // takes longer than one request) drives progress independently.
  triggerImportRun(`${redirectBase}/api/finance/qbo/import`, job.id);

  return NextResponse.redirect(`${redirectBase}/finances/import/${job.id}`);
}
