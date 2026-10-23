import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";
import type { PageData, PageTheme } from "@/lib/types/builder";

export type OfferTemplate = Tables<"offer_templates"> & {
  page_data: PageData;
  theme: PageTheme | null;
};

export async function getMyTemplates(): Promise<OfferTemplate[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("offer_templates")
    .select("*")
    .eq("owner_id", user.id)
    .eq("owner_type", "member")
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as OfferTemplate[];
}

/** Sage-Studio-maintained templates shared with every user — this table
 * is shared with creatorscircle.art (lib/db.ts's own top-of-file note),
 * which already seeded a library of these (book/album/concert/course/
 * etc. launch pages). getPlatformTemplates() previously returned a
 * hardcoded [] and the site-page editor never called it at all
 * (app/(builder)/my-site/[siteId]/pages/[pageId]/edit/page.tsx hardcoded
 * empty arrays instead) — so none of that existing library, including
 * the "Online Course" template, ever reached a Sage Studio site page. */
export async function getPlatformTemplates(): Promise<OfferTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offer_templates")
    .select("*")
    .eq("owner_type", "platform")
    .order("use_count", { ascending: false });

  return (data ?? []) as unknown as OfferTemplate[];
}
