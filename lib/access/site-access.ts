import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";

export type SiteRole = "owner" | "manager" | "editor" | "viewer";

const RANK: Record<SiteRole, number> = { viewer: 0, editor: 1, manager: 2, owner: 3 };

export function hasAtLeast(role: SiteRole | null, min: SiteRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export async function getSiteRole(
  supabase: SupabaseClient<Database>,
  siteId: string,
  userId: string
): Promise<SiteRole | null> {
  const { data: site } = await supabase
    .from("artist_sites")
    .select("user_id")
    .eq("id", siteId)
    .single();
  if (!site) return null;
  if (site.user_id === userId) return "owner";

  const { data: collaborator } = await supabase
    .from("site_collaborators")
    .select("role")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  return collaborator?.role ?? null;
}

export async function requireSiteRole(
  supabase: SupabaseClient<Database>,
  siteId: string,
  userId: string,
  min: SiteRole
): Promise<SiteRole> {
  const role = await getSiteRole(supabase, siteId, userId);
  if (!hasAtLeast(role, min)) throw new Error("Not authorized");
  return role!;
}

export async function requirePageRole(
  supabase: SupabaseClient<Database>,
  pageId: string,
  userId: string,
  min: SiteRole
): Promise<{ siteId: string; role: SiteRole }> {
  const { data: page } = await supabase
    .from("site_pages")
    .select("site_id")
    .eq("id", pageId)
    .single();
  if (!page) throw new Error("Page not found");
  const role = await requireSiteRole(supabase, page.site_id, userId, min);
  return { siteId: page.site_id, role };
}
