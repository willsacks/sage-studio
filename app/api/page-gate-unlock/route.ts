import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isRateLimited, isValidEmail } from "@/lib/utils/rate-limit";
import { recordSubscriberAndSync } from "@/lib/email/record-subscriber";

const UNLOCK_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

// Public, CORS-open like app/api/form-submit/route.ts — called from
// whatever origin the visitor is actually browsing (sagestudio.org/sites/...
// or a connected custom domain, both proxied through this deployment).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const body = await request.json() as {
    siteSlug?: string;
    pageId?: string;
    email?: string;
  };
  const { siteSlug, pageId, email } = body;

  if (!siteSlug || !pageId || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: CORS_HEADERS });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400, headers: CORS_HEADERS });
  }
  if (isRateLimited(`pgate:${ip}:${siteSlug}`, 10)) {
    return NextResponse.json({ error: "Too many requests, please try again shortly" }, { status: 429, headers: CORS_HEADERS });
  }

  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: site } = await (supabase as any)
      .from("artist_sites")
      .select("id")
      .eq("slug", siteSlug)
      .single();

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404, headers: CORS_HEADERS });
    }

    await recordSubscriberAndSync({
      siteId: site.id,
      siteSlug,
      email,
      sourceType: "page_gate",
      sourceId: pageId,
    });

    const response = NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    response.cookies.set(`sage_pgate_${pageId}`, "1", {
      maxAge: UNLOCK_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
    });
    return response;
  } catch (err) {
    console.error("page-gate-unlock error:", err);
    return NextResponse.json({ error: "Failed to unlock page" }, { status: 500, headers: CORS_HEADERS });
  }
}
