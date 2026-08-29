import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * QuickBooks' "Disconnect URL" — Intuit redirects a user's browser here
 * (GET, ?realmId=...) when they disconnect this app from their QuickBooks
 * Connected Apps settings. Unlike most platforms' webhooks, this redirect
 * carries no signature or other authentication (confirmed against Intuit's
 * own developer community — there is no documented way to cryptographically
 * verify the request came from Intuit). That bounds what this endpoint is
 * allowed to do: marking a connection "revoked" only stops future imports
 * from using it and forces a reconnect — it never deletes data or grants
 * access — so a spoofed request here has no meaningful blast radius. This
 * is a one-time historical migration connection, not an ongoing sync, so
 * there's nothing else to tear down.
 */
export async function GET(request: NextRequest) {
  const realmId = new URL(request.url).searchParams.get("realmId");

  if (realmId) {
    const supabase = createAdminClient();
    // Revokes every connection tied to this QuickBooks company, not just
    // one — a user could have imported the same company into more than one
    // Sage Studio entity, and qbo_connections has no uniqueness constraint
    // on realm_id itself (only on entity_id).
    await supabase.from("qbo_connections").update({ status: "revoked" }).eq("qbo_realm_id", realmId).eq("status", "active");
  }

  return new NextResponse(
    `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Disconnected — Sage Studio</title></head>
  <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f7fef9;">
    <div style="text-align: center; max-width: 28rem; padding: 2rem;">
      <h1 style="font-size: 1.25rem; margin-bottom: 0.5rem;">Disconnected from QuickBooks</h1>
      <p style="color: #555;">Sage Studio no longer has access to this QuickBooks company. Any books you already imported are unaffected.</p>
    </div>
  </body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
