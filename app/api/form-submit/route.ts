import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

// Best-effort abuse guard: this route is intentionally public (any artist site
// visitor can submit without auth), so it has no other gate. In-memory only —
// resets on cold start and isn't shared across serverless instances — but it
// stops simple scripted flooding without adding an external dependency.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
const submissionTimestamps = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (submissionTimestamps.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  submissionTimestamps.set(key, recent);
  // Bound map growth across distinct keys since cold-start-to-cold-start lifetime is short anyway.
  if (submissionTimestamps.size > 5000) submissionTimestamps.clear();
  return recent.length > RATE_LIMIT_MAX;
}

const MAX_ANSWER_FIELDS = 50;
const MAX_FIELD_LENGTH = 5000;

// formTitle/siteName/answers/questions all originate from the public request
// body (see POST below) and get sent as an HTML email — escape before
// interpolating so a crafted submission can't inject markup/links into the
// notification the artist receives.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    .map((r) => `<p style="margin:0 0 12px"><strong>${escapeHtml(r.label)}:</strong><br>${escapeHtml(r.value).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<div style="font-family:sans-serif;font-size:14px;color:#1a1a1a">
    <p>New submission on <strong>${escapeHtml(siteName)}</strong> — ${escapeHtml(formTitle)}</p>
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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

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

  if (Object.keys(answers).length > MAX_ANSWER_FIELDS || Object.values(answers).some((v) => String(v).length > MAX_FIELD_LENGTH)) {
    return NextResponse.json({ error: "Submission too large" }, { status: 400, headers: CORS_HEADERS });
  }

  if (isRateLimited(`${ip}:${siteSlug ?? "unknown"}`)) {
    return NextResponse.json({ error: "Too many submissions, please try again shortly" }, { status: 429, headers: CORS_HEADERS });
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
