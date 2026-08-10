import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSiteRole } from "@/lib/access/site-access";
import { revalidateSiteCacheFromRoute } from "@/lib/queries/sites";
import type { Json } from "@/lib/db";

/**
 * A plain route handler, not a Server Action, because Server Actions decode
 * their arguments through React's Flight protocol, which has a hardcoded
 * ~1,000,000-unit size limit on a request's decoded array/reference count —
 * not configurable via next.config's serverActions.bodySizeLimit. A single
 * large HTML string (real imported pages commonly run 500KB-1MB+) trips it
 * and fails with an opaque "Maximum array nesting exceeded" digest. Route
 * handlers parse the raw request body directly and aren't subject to that
 * limit — see also app/api/site-pages/update-html/route.ts, which has the
 * exact same reason for existing as a route instead of an action.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json() as { siteId?: string; title?: string; htmlContent?: string };
  const { siteId, title, htmlContent } = body;
  if (!siteId || !title || !htmlContent) {
    return NextResponse.json({ error: "Missing siteId, title, or htmlContent" }, { status: 400 });
  }

  try {
    await requireSiteRole(supabase, siteId, user.id, "editor");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: countResult } = await supabase
    .from("site_pages")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("site_pages")
    .insert({
      user_id: user.id,
      site_id: siteId,
      title,
      slug,
      page_type: "html",
      page_data: [] as unknown as Json,
      html_content: htmlContent,
      status: "draft",
      sort_order: (countResult as unknown as number) ?? 99,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath(`/my-site/${siteId}`);
  // Imported pages start as drafts (not publicly served), but revalidate
  // anyway so this stays correct if that default ever changes.
  await revalidateSiteCacheFromRoute(siteId);
  return NextResponse.json({ pageId: data.id });
}
