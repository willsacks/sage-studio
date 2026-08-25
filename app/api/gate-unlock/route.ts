import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { isRateLimited, isValidEmail } from "@/lib/utils/rate-limit";
import { recordSubscriberAndSync } from "@/lib/email/record-subscriber";

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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const body = await request.json() as {
    siteSlug?: string;
    blockId?: string;
    filePath?: string;
    email?: string;
  };
  const { siteSlug, blockId, filePath, email } = body;

  if (!siteSlug || !blockId || !filePath || !email) {
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
      .select("id, name, site_title, notification_email")
      .eq("slug", siteSlug)
      .single();

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404, headers: CORS_HEADERS });
    }

    await recordSubscriberAndSync({
      siteId: site.id,
      siteSlug,
      email,
      sourceType: "file_gate",
      sourceId: blockId,
    });

    const { data: signed, error: signError } = await supabase.storage
      .from("gated-files")
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

    if (signError || !signed) {
      throw new Error(signError?.message ?? "Could not generate download link");
    }

    // Best-effort owner notification — never blocks the download.
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

    return NextResponse.json(
      { downloadUrl: signed.signedUrl, expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString() },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("gate-unlock error:", err);
    return NextResponse.json({ error: "Failed to unlock download" }, { status: 500, headers: CORS_HEADERS });
  }
}
