"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";

export type ArtistSite = Tables<"artist_sites"> & {
  home_page_id?: string | null;
  footer_text?: string | null;
  ornamentation_key?: string | null;
};
export type SitePage = Tables<"site_pages"> & {
  show_in_nav?: boolean | null;
  hide_header?: boolean | null;
  og_image?: string | null;
  og_title?: string | null;
  og_description?: string | null;
};

export async function getMySites(): Promise<ArtistSite[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("artist_sites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) console.error("[getMySites]", error.message);
  return (data ?? []) as ArtistSite[];
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
