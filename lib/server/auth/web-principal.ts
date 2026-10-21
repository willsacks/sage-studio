import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import type { Module, Principal, ScopeLevel } from "@/lib/server/auth/principal";
import { ALL_MODULES } from "@/lib/server/auth/principal";

/** sage.* tables aren't reachable through PostgREST (by design — see
 * docs/schema-map.md), so even the web app's own Settings pages have to
 * go through withRls/withRlsWrite like the API does, using the current
 * cookie session. The "web" channel's scopes are never actually checked
 * (hasScope short-circuits to true for it, and sage.api_scope_allows()
 * does the same at the DB level) — this is just enough of a Principal
 * shape to satisfy the type. */
export async function getWebPrincipal(): Promise<Principal | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const scopes = Object.fromEntries(ALL_MODULES.map((m) => [m, "read" as ScopeLevel])) as Record<Module, ScopeLevel>;
  return { channel: "web", userId: user.id, scopes, requestId: randomUUID() };
}
