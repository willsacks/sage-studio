"use server";

import { createClient } from "@/lib/supabase/server";
import { approveAuthorizationRequest, denyAuthorizationRequest } from "@/lib/server/auth/oauth-flow";
import type { Module, ScopeLevel } from "@/lib/server/auth/principal";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function approveConsent(requestId: string, grantedModules: Module[]): Promise<{ error?: string; redirectTo?: string }> {
  const user = await requireUser();
  const scopes: Partial<Record<Module, ScopeLevel>> = {};
  for (const m of grantedModules) scopes[m] = "read";

  const result = await approveAuthorizationRequest(requestId, user.id, scopes, "OAuth connection");
  if ("error" in result) return { error: result.error };

  const url = new URL(result.redirectUri);
  url.searchParams.set("code", result.code);
  if (result.state) url.searchParams.set("state", result.state);
  return { redirectTo: url.toString() };
}

export async function denyConsent(requestId: string): Promise<{ error?: string; redirectTo?: string }> {
  const result = await denyAuthorizationRequest(requestId);
  if ("error" in result) return { error: result.error };
  const url = new URL(result.redirectUri);
  url.searchParams.set("error", "access_denied");
  if (result.state) url.searchParams.set("state", result.state);
  return { redirectTo: url.toString() };
}
