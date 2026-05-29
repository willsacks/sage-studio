import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json({ error: "No answers provided" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("form_submissions").insert({
      form_title: formTitle ?? "Application",
      site_slug: siteSlug ?? null,
      answers,
      questions,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("form-submit error:", err);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }
}
