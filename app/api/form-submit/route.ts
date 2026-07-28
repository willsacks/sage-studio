import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildNotificationEmailHtml(
  formTitle: string,
  siteName: string,
  answers: Record<string, string>,
  questions: Array<{ id: string; label: string; type: string }>
): string {
  const rows = questions.length > 0
    ? questions.map((q) => ({ label: q.label, value: answers[q.id] ?? "" }))
    : Object.entries(answers).map(([id, value]) => ({ label: id, value }));

  const fields = rows
    .filter((r) => r.value)
    .map((r) => `<p style="margin:0 0 12px"><strong>${r.label}:</strong><br>${r.value.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<div style="font-family:sans-serif;font-size:14px;color:#1a1a1a">
    <p>New submission on <strong>${siteName}</strong> — ${formTitle}</p>
    ${fields}
  </div>`;
}

// This is fetched from artist sites' own custom domains (e.g. lesliemurphy.com),
// which are cross-origin from this app's domain — allow any origin since the
// route accepts no credentials and only writes a form submission.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    formTitle?: string;
    siteSlug?: string;
    answers?: Record<string, string>;
    questions?: Array<{ id: string; label: string; type: string }>;
  };

  const { formTitle, siteSlug, answers = {}, questions = [] } = body;
  const title = formTitle ?? "Application";

  if (Object.keys(answers).length === 0) {
    return NextResponse.json({ error: "No answers provided" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("form_submissions").insert({
      form_title: title,
      site_slug: siteSlug ?? null,
      answers,
      questions,
    });

    if (error) throw error;

    // Best-effort notification email — the submission is already saved, so a
    // delivery failure here shouldn't fail the visitor-facing request.
    if (siteSlug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: site } = await (supabase as any)
        .from("artist_sites")
        .select("name, site_title, notification_email")
        .eq("slug", siteSlug)
        .single();

      if (site?.notification_email) {
        try {
          await resend.emails.send({
            from: "Sage Studio <notifications@sagestudio.org>",
            to: site.notification_email,
            replyTo: answers.email || undefined,
            subject: `New submission on ${site.site_title ?? site.name}`,
            html: buildNotificationEmailHtml(title, site.site_title ?? site.name, answers, questions),
          });
        } catch (emailErr) {
          console.error("form-submit notification email error:", emailErr);
        }
      }
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("form-submit error:", err);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500, headers: CORS_HEADERS });
  }
}
