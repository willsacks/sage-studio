"use server";

import { unstable_cache } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";
import { revalidateSiteCache } from "@/lib/queries/sites";

export type SitePost = Tables<"site_posts">;

export async function getPostsForSite(siteId: string): Promise<SitePost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_posts")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) console.error("[getPostsForSite]", error.message);
  return (data ?? []) as SitePost[];
}

export async function getSitePostById(id: string): Promise<SitePost | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_posts").select("*").eq("id", id).single();
  return data as SitePost | null;
}

// ─── Cached reads for the public /sites/[slug]/blog routes ──────────────
// Same admin-client + unstable_cache shape as lib/queries/sites.ts, reusing
// that file's `site:${slug}` cache tag so a post publish/edit invalidates
// alongside page changes with a single revalidateSiteCache(siteId) call —
// no separate tag needed since both live under the same site.

async function fetchSiteIdBySlugAdmin(slug: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("artist_sites").select("id").eq("slug", slug).single();
  return data?.id ?? null;
}

async function fetchPublishedPostsForSiteAdmin(siteSlug: string): Promise<SitePost[]> {
  const supabase = createAdminClient();
  const siteId = await fetchSiteIdBySlugAdmin(siteSlug);
  if (!siteId) return [];
  const { data } = await supabase
    .from("site_posts")
    .select("*")
    .eq("site_id", siteId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data ?? []) as SitePost[];
}

async function fetchPublishedPostBySlugAdmin(siteSlug: string, postSlug: string): Promise<SitePost | null> {
  const supabase = createAdminClient();
  const siteId = await fetchSiteIdBySlugAdmin(siteSlug);
  if (!siteId) return null;
  const { data } = await supabase
    .from("site_posts")
    .select("*")
    .eq("site_id", siteId)
    .eq("slug", postSlug)
    .eq("status", "published")
    .single();
  return data as SitePost | null;
}

const PUBLIC_CACHE_REVALIDATE_SECONDS = 60;

export async function getCachedPublishedPostsForSite(siteSlug: string): Promise<SitePost[]> {
  return unstable_cache(
    () => fetchPublishedPostsForSiteAdmin(siteSlug),
    ["published-posts-for-site", siteSlug],
    { tags: [`site:${siteSlug}`], revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS }
  )();
}

export async function getCachedPublishedPostBySlug(siteSlug: string, postSlug: string): Promise<SitePost | null> {
  return unstable_cache(
    () => fetchPublishedPostBySlugAdmin(siteSlug, postSlug),
    ["published-post-by-slug", siteSlug, postSlug],
    { tags: [`site:${siteSlug}`], revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS }
  )();
}

// Re-exported so call sites that already import post-related helpers from
// this module don't also need a separate import from lib/queries/sites.
export { revalidateSiteCache };
