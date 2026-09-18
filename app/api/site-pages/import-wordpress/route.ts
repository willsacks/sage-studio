import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireSiteRole } from "@/lib/access/site-access";
import { revalidateSiteCacheFromRoute } from "@/lib/queries/sites";
import {
  fetchWordPressPreview,
  importWordPressContent,
  WordPressImportError,
  type ImportSelection,
} from "@/lib/wordpress-import";

// A Route Handler rather than a Server Action for the same reason as
// app/api/site-pages/import-html/route.ts: imported page/post HTML can run
// well past React Flight's decoded-argument size limit. This route can also
// run considerably longer than a typical request (fetching + re-hosting
// every referenced image), which a Route Handler supports via maxDuration.
export const maxDuration = 300;

type Body =
  | { action: "preview"; siteUrl: string }
  | { action: "import"; siteId: string; siteUrl: string; selection: ImportSelection };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  try {
    if (body.action === "preview") {
      if (!body.siteUrl) return NextResponse.json({ error: "Missing siteUrl" }, { status: 400 });
      const preview = await fetchWordPressPreview(body.siteUrl);
      return NextResponse.json(preview);
    }

    if (body.action === "import") {
      if (!body.siteId || !body.siteUrl || !body.selection) {
        return NextResponse.json({ error: "Missing siteId, siteUrl, or selection" }, { status: 400 });
      }
      await requireSiteRole(supabase, body.siteId, user.id, "editor");
      const admin = createAdminClient();
      const result = await importWordPressContent(body.siteUrl, body.siteId, user.id, admin, body.selection);
      revalidatePath(`/my-site/${body.siteId}`);
      await revalidateSiteCacheFromRoute(body.siteId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof WordPressImportError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message === "Not authorized") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Import failed — please try again." }, { status: 500 });
  }
}
