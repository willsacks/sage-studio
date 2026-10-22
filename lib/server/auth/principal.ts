/** No "workspace" here — see docs/schema-map.md. A Principal always
 * resolves to exactly one Sage Studio user_id; per-resource permission
 * (SiteRole, Finance entity role) is checked separately, inside each
 * module's own service functions, not baked into this type. */
export type Channel = "web" | "mcp" | "api" | "pat";
export type Module = "todos" | "knowledge" | "time_tracking" | "sites" | "finance" | "courses" | "pipeline" | "process" | "newsletter";
export type ScopeLevel = "none" | "read" | "write";

export interface Principal {
  channel: Channel;
  userId: string;
  email?: string;
  /** Effective scopes for this request — already intersected with the
   * grant's own scopes if resolved from a token; "web" channel principals
   * don't carry real scopes (nothing checks them for that channel). */
  scopes: Record<Module, ScopeLevel>;
  grantId?: string;
  clientId?: string;
  clientName?: string;
  requestId: string;
}

export function hasScope(p: Principal, module: Module, min: ScopeLevel): boolean {
  if (p.channel === "web") return true; // web UI auth is handled entirely by existing cookie-session + RLS
  const level = p.scopes[module] ?? "none";
  if (min === "none") return true;
  if (min === "read") return level === "read" || level === "write";
  return level === "write";
}

export const ALL_MODULES: Module[] = ["todos", "knowledge", "time_tracking", "sites", "finance", "courses", "pipeline", "process", "newsletter"];
