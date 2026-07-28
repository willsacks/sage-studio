import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

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
    notificationEmail?: string;
    answers?: Record<string, string>;
    questions?: Array<{ id: string; label: string; type: string }>;
  };

  const { formTitle, siteSlug, answers = {}, questions = [] } = body;

  if (Object.keys(answers).length === 0) {
    return NextResponse.json({ error: "No answers provided" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("form_submissions").insert({
      form_title: formTitle ?? "Application",
      site_slug: siteSlug ?? null,
      answers,
      questions,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("form-submit error:", err);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500, headers: CORS_HEADERS });
  }
}
