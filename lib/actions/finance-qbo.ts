"use server";

import OAuthClient from "intuit-oauth";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { getQboOAuthClient } from "@/lib/finance/qbo-client";
import { signQboState } from "@/lib/crypto";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** No finance entity exists yet at this point — the entity is created by
 * the OAuth callback route once QuickBooks confirms the connection, per the
 * "always creates a new entity" design. The intended name/type is carried
 * through Intuit's redirect via a signed `state` param (a full-page
 * redirect can't rely on sessionStorage the way the Plaid Link popup does,
 * since some institutions/QuickBooks itself navigate the whole page away). */
export async function buildQboAuthUrl(params: { intendedEntityName: string; entityType: "personal" | "business" }) {
  const { user } = await requireAuth();

  const name = params.intendedEntityName.trim();
  if (!name) return { error: "A name is required" };

  const payload = JSON.stringify({ userId: user.id, intendedEntityName: name, entityType: params.entityType });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = signQboState(encodedPayload);
  const state = `${encodedPayload}.${signature}`;

  const oauthClient = getQboOAuthClient();
  const authUrl = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state,
  });
  return { authUrl };
}

export async function getQboConnectionStatus(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("qbo_connections")
    .select("status, environment, created_at, updated_at")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) return { error: error.message };
  return { connection: data };
}

/** Stops future syncing without deleting any imported data — this is a
 * one-time historical migration, not an ongoing sync like Plaid, so
 * "disconnect" just means "don't let this connection be used again." */
export async function disconnectQbo(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("qbo_connections").update({ status: "revoked" }).eq("entity_id", entityId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function getImportJobStatus(jobId: string) {
  const { supabase, user } = await requireAuth();

  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("owner_id", user.id)
    .single();
  if (error || !data) return { error: error?.message ?? "Import job not found" };
  return { job: data };
}
