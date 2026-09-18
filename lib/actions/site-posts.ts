"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSiteRole, requirePostRole } from "@/lib/access/site-access";
import { revalidateSiteCache } from "@/lib/queries/sites";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function baseSlugify(title: string): string {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "post";
}

/** Only appends a random suffix when the plain slug is already taken on
 * this site — most posts get a clean /blog/my-title URL; a collision (e.g.
 * two posts titled the same) is the only case that needs disambiguating. */
async function uniqueSlugForSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  title: string
): Promise<string> {
  const base = baseSlugify(title);
  const { data: existing } = await supabase.from("site_posts").select("slug").eq("site_id", siteId).like("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((p) => p.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Creates a draft post and returns its id — mirrors addSitePage's shape
 * (lib/actions/sites.ts) but posts have no template picker (one shape, one
 * editor) so there's nothing to choose beyond the title. */
export async function addSitePost(siteId: string, title: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");

  const trimmed = title.trim() || "Untitled post";
  const { data, error } = await supabase
    .from("site_posts")
    .insert({
      site_id: siteId,
      user_id: user.id,
      title: trimmed,
      slug: await uniqueSlugForSite(supabase, siteId, trimmed),
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create post" };

  revalidatePath(`/my-site/${siteId}`);
  return { postId: data.id as string };
}

export async function saveSitePost(
  postId: string,
  data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    coverImageUrl?: string | null;
    coverImageFocusX?: number;
    coverImageFocusY?: number;
    htmlContent?: string;
    metaTitle?: string | null;
    metaDescription?: string | null;
  }
) {
  const { supabase, user } = await requireAuth();
  const { siteId } = await requirePostRole(supabase, postId, user.id, "editor");

  const { error } = await supabase
    .from("site_posts")
    .update({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
      ...(data.coverImageUrl !== undefined ? { cover_image_url: data.coverImageUrl } : {}),
      ...(data.coverImageFocusX !== undefined ? { cover_image_focus_x: data.coverImageFocusX } : {}),
      ...(data.coverImageFocusY !== undefined ? { cover_image_focus_y: data.coverImageFocusY } : {}),
      ...(data.htmlContent !== undefined ? { html_content: data.htmlContent } : {}),
      ...(data.metaTitle !== undefined ? { meta_title: data.metaTitle } : {}),
      ...(data.metaDescription !== undefined ? { meta_description: data.metaDescription } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) return { error: error.message };

  revalidatePath(`/my-site/${siteId}/posts/${postId}/edit`);
  await revalidateSiteCache(siteId);
  return { success: true };
}

export async function togglePostPublished(postId: string, siteId: string, publish: boolean) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");

  const { error } = await supabase
    .from("site_posts")
    .update({
      status: publish ? "published" : "draft",
      // published_at is set once on first publish and never overwritten by
      // a later unpublish/republish, so a post's original publish date
      // (what a blog archive sorts and displays by) doesn't reset just
      // because it was briefly unpublished for an edit.
      ...(publish ? { published_at: undefined } : {}),
    })
    .eq("id", postId)
    .eq("site_id", siteId);
  if (error) return { error: error.message };

  if (publish) {
    await supabase
      .from("site_posts")
      .update({ published_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("site_id", siteId)
      .is("published_at", null);
  }

  revalidatePath(`/my-site/${siteId}`);
  await revalidateSiteCache(siteId);
  return { success: true };
}

export async function deleteSitePost(postId: string, siteId: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");

  const { error } = await supabase.from("site_posts").delete().eq("id", postId).eq("site_id", siteId);
  if (error) return { error: error.message };

  revalidatePath(`/my-site/${siteId}`);
  await revalidateSiteCache(siteId);
  return { success: true };
}
