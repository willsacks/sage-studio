import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClientForUser } from "@/lib/email/resend-client";

/**
 * A plain route handler, not a Server Action — same reasoning as
 * app/api/site-pages/import-html/route.ts: Server Actions decode their
 * arguments through React's Flight protocol, which has a hard
 * ~1,000,000-unit size limit unrelated to next.config's
 * serverActions.bodySizeLimit. A CSV of a few thousand contacts can trip
 * it. Unlike the public gate routes, this one requires an authenticated
 * session — it's an account-management action, not a public capture.
 *
 * Resend has its own native contact-import endpoint
 * (resend.contacts.imports.create) that handles column mapping, dedupe,
 * and list assignment — this route just forwards the uploaded file to it
 * rather than parsing CSVs itself.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const resend = await getResendClientForUser(user.id);
  if (!resend) return NextResponse.json({ error: "Connect Resend first" }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get("file");
  const listIds = formData.getAll("listId").map((v) => String(v)).filter(Boolean);

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (listIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one list" }, { status: 400 });
  }

  try {
    const { data, error } = await resend.contacts.imports.create({
      file,
      segments: listIds.map((id) => ({ id })),
      onConflict: "upsert",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ import: data });
  } catch (err) {
    console.error("import-contacts error:", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
