"use server";

import { unstable_cache, revalidateTag, updateTag } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";
import type { SiteRole } from "@/lib/access/site-access";

export type ArtistSite = Tables<"artist_sites"> & {
  home_page_id?: string | null;
  footer_text?: string | null;
  ornamentation_key?: string | null;
  favicon_url?: string | null;
  myRole?: SiteRole;
};
export type SitePage = Tables<"site_pages"> & {
  show_in_nav?: boolean | null;
  hide_header?: boolean | null;
  og_image?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  parent_page_id?: string | null;
};

export async function getMySites(): Promise<ArtistSite[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [ownedResult, collabResult] = await Promise.all([
    supabase.from("artist_sites").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("site_collaborators").select("site_id, role").eq("user_id", user.id).eq("status", "accepted"),
  ]);

  if (ownedResult.error) console.error("[getMySites]", ownedResult.error.message);
  if (collabResult.error) console.error("[getMySites:collab]", collabResult.error.message);

  const owned = (ownedResult.data ?? []).map((site) => ({ ...site, myRole: "owner" as const })) as ArtistSite[];

  const collabRows = collabResult.data ?? [];
  if (collabRows.length === 0) return owned;

  const sharedIds = collabRows.map((row) => row.site_id);
  const { data: sharedSites, error: sharedError } = await supabase
    .from("artist_sites")
    .select("*")
    .in("id", sharedIds);
  if (sharedError) console.error("[getMySites:sharedSites]", sharedError.message);

  const roleBySiteId = new Map(collabRows.map((row) => [row.site_id, row.role as SiteRole]));
  const shared = (sharedSites ?? []).map((site) => ({
    ...site,
    myRole: roleBySiteId.get(site.id) ?? "viewer",
  })) as ArtistSite[];

  return [...owned, ...shared];
}

export async function getSiteById(id: string): Promise<ArtistSite | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("artist_sites").select("*").eq("id", id).single();
  return data as ArtistSite | null;
}

export async function getSiteBySlug(slug: string): Promise<ArtistSite | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("artist_sites").select("*").eq("slug", slug).single();
  return data as ArtistSite | null;
}

export async function getPagesForSite(siteId: string): Promise<SitePage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select("*")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true });
  if (error) console.error("[getPagesForSite]", error.message);
  return (data ?? []) as SitePage[];
}

export async function getSitePageById(id: string): Promise<SitePage | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_pages").select("*").eq("id", id).single();
  return data as SitePage | null;
}

export async function getPublishedPagesForSite(siteSlug: string): Promise<SitePage[]> {
  const supabase = await createClient();
  const site = await getSiteBySlug(siteSlug);
  if (!site) return [];
  const { data } = await supabase
    .from("site_pages")
    .select("*")
    .eq("site_id", site.id)
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  return (data ?? []) as SitePage[];
}

export async function getPublishedPageBySlug(siteSlug: string, pageSlug: string): Promise<SitePage | null> {
  const supabase = await createClient();
  const site = await getSiteBySlug(siteSlug);
  if (!site) return null;
  const { data } = await supabase
    .from("site_pages")
    .select("*")
    .eq("site_id", site.id)
    .eq("slug", pageSlug)
    .eq("status", "published")
    .single();
  return data as SitePage | null;
}

// ─── Cached reads for the public /sites/[slug] routes ───────────────────
//
// The functions above are used by the dashboard/editor and must always see
// fresh data (they run behind the cookie-bound client and reflect the
// user's own in-progress edits). The public-facing routes instead use
// these, which run on the admin client (no cookies — safe inside
// unstable_cache) and are cached per site slug so an anonymous visit
// doesn't trigger a fresh Supabase round-trip every time. Every write path
// that can affect what a visitor sees must call revalidateSiteCache(siteId)
// (or revalidateSiteCacheBySlug) so a save is reflected promptly instead of
// waiting out the time-based fallback.

async function fetchSiteBySlugAdmin(slug: string): Promise<ArtistSite | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("artist_sites").select("*").eq("slug", slug).single();
  return data as ArtistSite | null;
}

async function fetchPublishedPagesForSiteAdmin(siteSlug: string): Promise<SitePage[]> {
  const supabase = createAdminClient();
  const site = await fetchSiteBySlugAdmin(siteSlug);
  if (!site) return [];
  const { data } = await supabase
    .from("site_pages")
    .select("*")
    .eq("site_id", site.id)
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  return (data ?? []) as SitePage[];
}

async function fetchPublishedPageBySlugAdmin(siteSlug: string, pageSlug: string): Promise<SitePage | null> {
  const supabase = createAdminClient();
  const site = await fetchSiteBySlugAdmin(siteSlug);
  if (!site) return null;
  const { data } = await supabase
    .from("site_pages")
    .select("*")
    .eq("site_id", site.id)
    .eq("slug", pageSlug)
    .eq("status", "published")
    .single();
  return data as SitePage | null;
}

// 60s fallback revalidate is a safety net only — the expected path is
// on-demand invalidation via revalidateSiteCache from every write action.
const PUBLIC_CACHE_REVALIDATE_SECONDS = 60;

export async function getCachedSiteBySlug(slug: string): Promise<ArtistSite | null> {
  return unstable_cache(
    () => fetchSiteBySlugAdmin(slug),
    ["site-by-slug", slug],
    { tags: [`site:${slug}`], revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS }
  )();
}

export async function getCachedPublishedPagesForSite(siteSlug: string): Promise<SitePage[]> {
  return unstable_cache(
    () => fetchPublishedPagesForSiteAdmin(siteSlug),
    ["published-pages-for-site", siteSlug],
    { tags: [`site:${siteSlug}`], revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS }
  )();
}

export async function getCachedPublishedPageBySlug(siteSlug: string, pageSlug: string): Promise<SitePage | null> {
  return unstable_cache(
    () => fetchPublishedPageBySlugAdmin(siteSlug, pageSlug),
    ["published-page-by-slug", siteSlug, pageSlug],
    { tags: [`site:${siteSlug}`], revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS }
  )();
}

async function resolveSiteSlug(siteId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("artist_sites").select("slug").eq("id", siteId).single();
  return data?.slug ?? null;
}

/** Invalidates the public-site cache for a site identified by id — the
 * shape every mutation action already has on hand. Resolves slug via the
 * admin client (uncached — a single indexed row lookup, negligible next to
 * the write it's paired with).
 *
 * Server Actions only — `updateTag` requires the Server Action execution
 * context and gives read-your-own-writes (next request blocks for fresh
 * data instead of serving stale). Route Handlers must use
 * `revalidateSiteCacheFromRoute` instead. */
export async function revalidateSiteCache(siteId: string): Promise<void> {
  const slug = await resolveSiteSlug(siteId);
  if (slug) updateTag(`site:${slug}`);
}

/** Route Handler equivalent of revalidateSiteCache — `updateTag` can only
 * run inside a Server Action, so routes use `revalidateTag` with an
 * immediate-expiry profile to get the same "next visit sees fresh data"
 * behavior instead of stale-while-revalidate. */
export async function revalidateSiteCacheFromRoute(siteId: string): Promise<void> {
  const slug = await resolveSiteSlug(siteId);
  if (slug) revalidateTag(`site:${slug}`, { expire: 0 });
}
