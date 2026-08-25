import { NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isRateLimited, isValidEmail, getClientIp } from "@/lib/utils/rate-limit";
import { recordSubscriberAndSync } from "@/lib/email/record-subscriber";
import { signGateToken } from "@/lib/crypto";
import { pageGateCookieName, PAGE_GATE_COOKIE_MAX_AGE_SECONDS } from "@/lib/utils/page-gate";

// Public, CORS-open like app/api/form-submit/route.ts. No
// Allow-Credentials header — the client's fetch("/api/page-gate-unlock")
// is always same-origin (a relative path from the gated page itself), so
// there's nothing that needs it, and pairing Allow-Credentials with a
// wildcard origin is invalid per spec anyway (browsers refuse to honor
// credentialed cross-origin requests with `Allow-Origin: *`).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

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
      .select("id, is_published")
      .eq("slug", siteSlug)
      .single();

    if (!site || !site.is_published) {
      return NextResponse.json({ error: "Site not found" }, { status: 404, headers: CORS_HEADERS });
    }

    // Tie pageId to this exact site and confirm it's actually gated, rather
    // than trusting a bare id from the request body — otherwise any
    // syntactically valid (siteSlug, made-up pageId) pair would still
    // record a subscriber and hand back a working (if useless) unlock
    // cookie for a page that doesn't exist or was never gated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: page } = await (supabase as any)
      .from("site_pages")
      .select("id, is_gated")
      .eq("id", pageId)
      .eq("site_id", site.id)
      .single();

    if (!page || !page.is_gated) {
      return NextResponse.json({ error: "Page not found" }, { status: 404, headers: CORS_HEADERS });
    }

    // Best-effort — never blocks the unlock itself.
    after(async () => {
      try {
        await recordSubscriberAndSync({
          siteId: site.id,
          siteSlug,
          email,
          sourceType: "page_gate",
          sourceId: pageId,
        });
      } catch (err) {
        console.error("page-gate-unlock recordSubscriberAndSync error:", err);
      }
    });

    const response = NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    // Signed rather than a bare "1" — otherwise a visitor could set this
    // cookie themselves via devtools and bypass the gate without ever
    // submitting an email. See lib/crypto.ts's signGateToken.
    response.cookies.set(pageGateCookieName(pageId), signGateToken(pageId), {
      maxAge: PAGE_GATE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
    });
    return response;
  } catch (err) {
    console.error("page-gate-unlock error:", err);
    return NextResponse.json({ error: "Failed to unlock page" }, { status: 500, headers: CORS_HEADERS });
  }
}
