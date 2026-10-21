import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveClientForAuthorize } from "@/lib/server/auth/oauth-clients";
import { createAuthorizationRequest } from "@/lib/server/auth/oauth-flow";
import { ISSUER } from "@/lib/server/auth/oauth-jwt";
import { ALL_MODULES, type Module, type ScopeLevel } from "@/lib/server/auth/principal";
import { ConsentForm } from "@/components/oauth/ConsentForm";

const MODULE_LABELS: Record<Module, string> = {
  todos: "To-dos",
  knowledge: "Knowledge base",
  time_tracking: "Time tracking",
  sites: "Websites",
  finance: "Finance",
  courses: "Courses",
};

const WRITABLE_MODULES = new Set<Module>(["todos", "knowledge", "time_tracking", "sites"]);

/** Parses an OAuth `scope` string into per-module levels. Each token is
 * either a bare module name (defaults to "read") or "module:write" — a
 * client can only ever be offered what it explicitly asked for, never
 * more, so an unparseable/unwritable combination just falls back to read. */
function parseRequestedScopes(scope: string | undefined): Partial<Record<Module, ScopeLevel>> {
  const result: Partial<Record<Module, ScopeLevel>> = {};
  for (const token of (scope ?? "").split(/\s+/).filter(Boolean)) {
    const [name, level] = token.split(":");
    if (!ALL_MODULES.includes(name as Module)) continue;
    const module = name as Module;
    result[module] = level === "write" && WRITABLE_MODULES.has(module) ? "write" : "read";
  }
  return result;
}

function errorPage(title: string, message: string) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-lg font-semibold text-red-600">{title}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
      </div>
    </div>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    resource,
    scope,
  } = sp;

  if (responseType !== "code") return errorPage("Unsupported request", "Only the authorization code flow is supported.");
  if (!clientId || !redirectUri || !codeChallenge) return errorPage("Invalid request", "This authorization request is missing required parameters.");
  if (codeChallengeMethod !== "S256") return errorPage("Invalid request", "Only PKCE with S256 is supported.");
  // RFC 8707 resource indicator — there's only one resource server
  // (this app), so reject anything that doesn't name it rather than
  // silently storing an arbitrary client-supplied value.
  if (resource && resource !== ISSUER) return errorPage("Invalid resource", "This authorization server only issues tokens for Sage Studio's own API.");

  let client;
  try {
    client = await resolveClientForAuthorize(clientId);
  } catch (err) {
    return errorPage("Unknown client", err instanceof Error ? err.message : "Could not resolve this client.");
  }

  if (!client.redirectUris.includes(redirectUri)) {
    return errorPage("Invalid redirect", "The redirect URI doesn't match what this client registered.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const fullPath = `/oauth/authorize?${new URLSearchParams(sp as Record<string, string>).toString()}`;
    redirect(`/login?next=${encodeURIComponent(fullPath)}`);
  }

  const requestedScopes = parseRequestedScopes(scope);
  const modulesToOffer = (Object.keys(requestedScopes).length > 0 ? (Object.keys(requestedScopes) as Module[]) : ALL_MODULES);
  // Unqualified request (no scope param at all, or a module scope isn't
  // writable) — same "read unless asked otherwise" default.
  for (const m of modulesToOffer) if (!(m in requestedScopes)) requestedScopes[m] = "read";

  const requestId = await createAuthorizationRequest({
    clientId: client.id,
    redirectUri,
    state: state ?? null,
    codeChallenge,
    resource: resource ?? ISSUER,
    scopesRequested: modulesToOffer.map((m) => (requestedScopes[m] === "write" ? `${m}:write` : m)),
  });

  const redirectHost = new URL(redirectUri).host;
  const anyWriteRequested = Object.values(requestedScopes).includes("write");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold">Connect {client.clientName}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {client.clientName} wants {anyWriteRequested ? "access to" : "read-only access to"} your Sage Studio account.
            {!client.verified && (
              <span className="block mt-2 text-amber-600">
                This app is not verified. It will redirect to <span className="font-mono">{redirectHost}</span> after you decide.
              </span>
            )}
          </p>
        </div>

        <ConsentForm
          requestId={requestId}
          modules={modulesToOffer.map((m) => ({
            key: m,
            label: MODULE_LABELS[m],
            requestedLevel: requestedScopes[m] ?? "read",
            writable: WRITABLE_MODULES.has(m),
          }))}
        />

        <p className="text-xs text-[var(--muted-foreground)]">
          It can never move money. You can revoke this connection anytime from Settings.
        </p>
      </div>
    </div>
  );
}
