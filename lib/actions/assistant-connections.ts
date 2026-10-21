"use server";

import { createClient } from "@/lib/supabase/server";
import { createPersonalAccessToken } from "@/lib/server/auth/pat";
import { ALL_MODULES, type Module, type ScopeLevel } from "@/lib/server/auth/principal";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/** Creates a personal access token for the current user — the one piece
 * of Settings → Connected Apps (full UI arrives in M3) needed to test the
 * REST/MCP layer end to end today. `scopes` only needs to list the
 * modules being granted; anything omitted defaults to "none". */
export async function createAssistantConnection(displayName: string, scopes: Partial<Record<Module, ScopeLevel>>) {
  const user = await requireAuth();
  const trimmed = displayName.trim();
  if (!trimmed) return { error: "Name is required" };

  const fullScopes = Object.fromEntries(ALL_MODULES.map((m) => [m, scopes[m] ?? "none"])) as Record<Module, ScopeLevel>;
  const result = await createPersonalAccessToken(user.id, trimmed, fullScopes);
  if ("error" in result) return result;
  return { token: result.token, grantId: result.grantId };
}
