import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePageRole } from "@/lib/access/site-access";

/**
 * Route handler, not a Server Action — see the comment in
 * app/api/site-pages/import-html/route.ts for why. This is the save path
 * for every existing HTML page, so it hits the same limit whenever an
 * edited page's HTML crosses roughly 1MB.
 *
 * Optimistic concurrency: the client sends the `updated_at` it loaded the
 * page with. The update is conditioned on that value still matching the row
 * in the database, so a save from a stale in-memory copy (e.g. an editor tab
 * left open while another edit — script or another tab — landed in between)
 * is rejected with 409 instead of silently overwriting the newer content.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json() as { pageId?: string; htmlContent?: string; expectedUpdatedAt?: string };
  const { pageId, htmlContent, expectedUpdatedAt } = body;
  if (!pageId || htmlContent === undefined) {
    return NextResponse.json({ error: "Missing pageId or htmlContent" }, { status: 400 });
  }
  if (!expectedUpdatedAt) {
    return NextResponse.json({ error: "Missing expectedUpdatedAt" }, { status: 400 });
  }

  try {
    await requirePageRole(supabase, pageId, user.id, "editor");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const nextUpdatedAt = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("site_pages")
    .update({ html_content: htmlContent, updated_at: nextUpdatedAt })
    .eq("id", pageId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from("site_pages")
      .select("updated_at")
      .eq("id", pageId)
      .maybeSingle();
    // Row may simply not exist (bad pageId) rather than a real conflict.
    if (!current) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json(
      { error: "This page was changed elsewhere since you loaded it. Reload to see the latest version before saving.", conflict: true },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, updatedAt: nextUpdatedAt });
}
