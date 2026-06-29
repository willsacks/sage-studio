import { createClient, createAdminClient } from "@/lib/supabase/server";
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

export type InvitePreview = {
  siteId: string;
  siteName: string;
  role: "viewer" | "editor" | "manager";
  inviterName: string;
};

// Looked up before the visitor is authenticated, so it uses the service-role
// client (same reasoning as acceptInvite — the invite_token is what authorizes
// reading this one row, not the visitor's own access).
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("site_collaborators")
    .select("site_id, role, invited_by")
    .eq("invite_token", token)
    .single();
  if (!invite) return null;

  const [{ data: site }, { data: inviter }] = await Promise.all([
    admin.from("artist_sites").select("name").eq("id", invite.site_id).single(),
    admin.from("profiles").select("display_name, username").eq("id", invite.invited_by).single(),
  ]);

  return {
    siteId: invite.site_id,
    siteName: site?.name ?? "this site",
    role: invite.role,
    inviterName: inviter?.display_name || inviter?.username || "Someone",
  };
}
