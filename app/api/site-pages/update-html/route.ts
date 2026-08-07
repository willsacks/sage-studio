import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePageRole } from "@/lib/access/site-access";

/**
 * Route handler, not a Server Action — see the comment in
 * app/api/site-pages/import-html/route.ts for why. This is the save path
 * for every existing HTML page, so it hits the same limit whenever an
 * edited page's HTML crosses roughly 1MB.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json() as { pageId?: string; htmlContent?: string };
  const { pageId, htmlContent } = body;
  if (!pageId || htmlContent === undefined) {
    return NextResponse.json({ error: "Missing pageId or htmlContent" }, { status: 400 });
  }

  try {
    await requirePageRole(supabase, pageId, user.id, "editor");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("site_pages")
    .update({ html_content: htmlContent, updated_at: new Date().toISOString() })
    .eq("id", pageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
