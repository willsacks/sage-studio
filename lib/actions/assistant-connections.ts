"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPersonalAccessToken } from "@/lib/server/auth/pat";
import { withRls, withRlsWrite } from "@/lib/server/db/with-rls";
import { getWebPrincipal } from "@/lib/server/auth/web-principal";
import { ALL_MODULES, type Module, type ScopeLevel } from "@/lib/server/auth/principal";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export interface ConnectionRow {
  id: string;
  displayName: string;
  scopes: Partial<Record<Module, ScopeLevel>>;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Creates a personal access token for the current user — the one piece
 * of Settings → Connected Apps needed to test the REST/MCP layer before
 * the full OAuth flow (M3's other half) lands. `scopes` only needs to
 * list the modules being granted; anything omitted defaults to "none". */
export async function createAssistantConnection(displayName: string, scopes: Partial<Record<Module, ScopeLevel>>) {
  const user = await requireAuth();
  const trimmed = displayName.trim();
  if (!trimmed) return { error: "Name is required" };

  const fullScopes = Object.fromEntries(ALL_MODULES.map((m) => [m, scopes[m] ?? "none"])) as Record<Module, ScopeLevel>;
  const result = await createPersonalAccessToken(user.id, trimmed, fullScopes);
  if ("error" in result) return result;
  revalidatePath("/settings/assistants");
  return { token: result.token, grantId: result.grantId };
}

export async function listAssistantConnections(): Promise<ConnectionRow[]> {
  const principal = await getWebPrincipal();
  if (!principal) return [];
  const { rows } = await withRls(principal, (db) =>
    db.query(
      `select id, display_name, scopes, status, created_at, last_used_at
       from sage.connected_apps where user_id = $1 order by created_at desc`,
      [principal.userId]
    )
  );
  return rows.map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    scopes: r.scopes as Partial<Record<Module, ScopeLevel>>,
    status: r.status as string,
    createdAt: r.created_at as string,
    lastUsedAt: r.last_used_at as string | null,
  }));
}

export async function revokeAssistantConnection(grantId: string) {
  const principal = await getWebPrincipal();
  if (!principal) return { error: "Not authenticated" };
  await withRlsWrite(principal, (db) =>
    db.query(`update sage.connected_apps set status = 'revoked', revoked_at = now() where id = $1 and user_id = $2`, [grantId, principal.userId])
  );
  revalidatePath("/settings/assistants");
  return { success: true };
}
