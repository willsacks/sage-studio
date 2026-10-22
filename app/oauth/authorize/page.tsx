import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveClientForAuthorize } from "@/lib/server/auth/oauth-clients";
import { createAuthorizationRequest } from "@/lib/server/auth/oauth-flow";
import { ISSUER, isAcceptedResource } from "@/lib/server/auth/oauth-jwt";
import { writeOauthAuditLog } from "@/lib/server/audit/write";
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

const WRITABLE_MODULES = new Set<Module>(["todos", "knowledge", "time_tracking", "sites", "finance", "courses"]);

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
  // silently storing an arbitrary client-supplied value. Logged on
  // rejection (DB, not just stdout — Vercel's log stream only tails
  // live, so a one-off real-client failure is otherwise unrecoverable
  // after the fact) so a real client's exact rejected value is visible
  // without needing to catch it live.
  if (resource && !isAcceptedResource(resource)) {
    console.error("[oauth/authorize] rejected resource param:", JSON.stringify(resource), "full query:", JSON.stringify(sp));
    await writeOauthAuditLog({ operation: "oauth.invalidResourceRejected", status: "denied", clientId: clientId ?? null, errorCode: `resource=${resource}`.slice(0, 250) });
    return errorPage("Invalid resource", "This authorization server only issues tokens for Sage Studio's own API.");
  }

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
  // A client that sent no `scope` at all asked for nothing in particular
  // — there's nothing to "narrow" below, so the ceiling defaults to
  // everything, write included, and the human's own consent-screen
  // choices are the real gate (same UI either way: every module listed
  // with its own read/write toggle). A client that DID send a scope
  // string but left a module out of it is a deliberate narrower request
  // — that still defaults to read-only, same as before. Real client seen
  // in practice (Grok) sends no scope param at all; without this it got
  // silently read-only with no way to ask for more.
  const clientSpecifiedScope = !!scope && scope.trim().length > 0;
  const modulesToOffer = (clientSpecifiedScope && Object.keys(requestedScopes).length > 0 ? (Object.keys(requestedScopes) as Module[]) : ALL_MODULES);
  for (const m of modulesToOffer) {
    if (!(m in requestedScopes)) requestedScopes[m] = clientSpecifiedScope ? "read" : (WRITABLE_MODULES.has(m) ? "write" : "read");
  }

  const requestId = await createAuthorizationRequest({
    clientId: client.id,
    redirectUri,
    state: state ?? null,
    codeChallenge,
    // Normalize to ISSUER regardless of which accepted variant the
    // client sent (bare origin vs. the MCP/REST endpoint URL) — there's
    // only one real resource server, and the token's audience must
    // always match what bearer.ts actually verifies against.
    resource: ISSUER,
    scopesRequested: modulesToOffer.map((m) => (requestedScopes[m] === "write" ? `${m}:write` : m)),
  });

  const redirectHost = new URL(redirectUri).host;
  // Only describe this as wanting write access when the client actually
  // asked for it — not when the ceiling merely allows it because the
  // client specified no scope at all (see defaultLevel below).
  const anyWriteRequested = clientSpecifiedScope && Object.values(requestedScopes).includes("write");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold">Connect {client.clientName}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {client.clientName} wants {anyWriteRequested ? "access to" : "read-only access to"} your Sage Studio account.
            {!clientSpecifiedScope && " It didn't ask for anything specific, so pick what to share below — nothing is granted until you choose."}
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
            // When the client explicitly asked for this module/level,
            // pre-check exactly that (same as before). When it asked for
            // nothing, the ceiling above still allows write, but nothing
            // is pre-selected beyond read — see ConsentForm's doc comment.
            defaultLevel: clientSpecifiedScope ? (requestedScopes[m] ?? "read") : "read",
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
