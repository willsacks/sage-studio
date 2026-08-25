import { NextResponse } from "next/server";
import { after } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { isRateLimited, isValidEmail, getClientIp } from "@/lib/utils/rate-limit";
import { recordSubscriberAndSync } from "@/lib/email/record-subscriber";
import { findGateBlockFilePath } from "@/lib/email/find-gate-block";

const resend = new Resend(process.env.RESEND_API_KEY);
const SIGNED_URL_EXPIRY_SECONDS = 300;

// Public, CORS-open like app/api/form-submit/route.ts — an EmailGateBlock
// can render on an artist's own custom domain, cross-origin from this app.
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
    blockId?: string;
    email?: string;
  };
  const { siteSlug, blockId, email } = body;

  if (!siteSlug || !blockId || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: CORS_HEADERS });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400, headers: CORS_HEADERS });
  }
  if (isRateLimited(`gate:${ip}:${siteSlug}`, 10)) {
    return NextResponse.json({ error: "Too many requests, please try again shortly" }, { status: 429, headers: CORS_HEADERS });
  }

  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: site } = await (supabase as any)
      .from("artist_sites")
      .select("id, name, site_title, notification_email, is_published")
      .eq("slug", siteSlug)
      .single();

    if (!site || !site.is_published) {
      return NextResponse.json({ error: "Site not found" }, { status: 404, headers: CORS_HEADERS });
    }

    // Resolve the file path authoritatively from the site's own block data —
    // never trust a client-supplied path, since nothing would otherwise tie
    // together an arbitrary (siteSlug, filePath) pair and let one site's
    // visitor download another site's gated file.
    const filePath = await findGateBlockFilePath(supabase, site.id, blockId);
    if (!filePath) {
      return NextResponse.json({ error: "This download is no longer available" }, { status: 404, headers: CORS_HEADERS });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("gated-files")
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

    if (signError || !signed) {
      throw new Error(signError?.message ?? "Could not generate download link");
    }

    // Subscriber recording + Resend sync + owner notification are all
    // best-effort side effects that shouldn't delay the visitor's download —
    // deferred via `after()` so they run once the response has been sent,
    // instead of the visitor waiting on a live third-party API round-trip
    // for something that doesn't affect whether they get their file.
    after(async () => {
      try {
        await recordSubscriberAndSync({
          siteId: site.id,
          siteSlug,
          email,
          sourceType: "file_gate",
          sourceId: blockId,
        });
      } catch (err) {
        console.error("gate-unlock recordSubscriberAndSync error:", err);
      }

      if (site.notification_email) {
        try {
          await resend.emails.send({
            from: "Sage Studio <notifications@sagestudio.org>",
            to: site.notification_email,
            replyTo: email,
            subject: `New download unlocked on ${site.site_title ?? site.name}`,
            html: `<div style="font-family:sans-serif;font-size:14px;color:#1a1a1a"><p><strong>${email}</strong> just unlocked a gated download on your site.</p></div>`,
          });
        } catch (emailErr) {
          console.error("gate-unlock notification email error:", emailErr);
        }
      }
    });

    return NextResponse.json(
      { downloadUrl: signed.signedUrl, expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString() },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("gate-unlock error:", err);
    return NextResponse.json({ error: "Failed to unlock download" }, { status: 500, headers: CORS_HEADERS });
  }
}
