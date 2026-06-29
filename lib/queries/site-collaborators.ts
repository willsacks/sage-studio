import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";

export type SiteCollaborator = Tables<"site_collaborators">;

export async function getCollaboratorsForSite(siteId: string): Promise<SiteCollaborator[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_collaborators")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });
  if (error) console.error("[getCollaboratorsForSite]", error.message);
  return data ?? [];
}
