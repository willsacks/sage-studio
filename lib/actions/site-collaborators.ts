"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireSiteRole, type SiteRole } from "@/lib/access/site-access";
import type { SiteCollaborator } from "@/lib/queries/site-collaborators";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function inviteCollaborator(
  siteId: string,
  email: string,
  role: "viewer" | "editor" | "manager"
): Promise<{ error?: string; collaborator?: SiteCollaborator }> {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "manager");

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return { error: "Enter a valid email address" };

  const { data, error } = await supabase
    .from("site_collaborators")
    .insert({ site_id: siteId, email: cleanEmail, role, invited_by: user.id })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "This email has already been invited to this site" };
    return { error: error.message };
  }

  revalidatePath(`/my-site/${siteId}/settings`);
  return { collaborator: data };
}

export async function updateCollaboratorRole(collaboratorId: string, role: "viewer" | "editor" | "manager") {
  const { supabase, user } = await requireAuth();

  const { data: collaborator } = await supabase
    .from("site_collaborators")
    .select("site_id")
    .eq("id", collaboratorId)
    .single();
  if (!collaborator) return { error: "Collaborator not found" };

  await requireSiteRole(supabase, collaborator.site_id, user.id, "manager");

  const { error } = await supabase
    .from("site_collaborators")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", collaboratorId);
  if (error) return { error: error.message };

  revalidatePath(`/my-site/${collaborator.site_id}/settings`);
  return { success: true };
}

export async function removeCollaborator(collaboratorId: string) {
  const { supabase, user } = await requireAuth();

  const { data: collaborator } = await supabase
    .from("site_collaborators")
    .select("site_id")
    .eq("id", collaboratorId)
    .single();
  if (!collaborator) return { error: "Collaborator not found" };

  await requireSiteRole(supabase, collaborator.site_id, user.id, "manager");

  await supabase.from("site_collaborators").delete().eq("id", collaboratorId);
  revalidatePath(`/my-site/${collaborator.site_id}/settings`);
  revalidatePath("/my-site");
  return { success: true };
}

export async function acceptInvite(
  token: string
): Promise<{ siteId: string; siteName: string; role: SiteRole } | { error: string }> {
  // requireAuth() confirms there's a real logged-in session; the actual lookup below
  // uses the service-role client because a brand-new invitee won't yet match any
  // RLS policy on site_collaborators (they're not the owner or an existing
  // collaborator) — the invite_token itself is what authorizes this one operation.
  const { user } = await requireAuth();
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("site_collaborators")
    .select("id, site_id, role, status, user_id")
    .eq("invite_token", token)
    .single();

  if (!invite) return { error: "This invite link is invalid." };
  if (invite.status === "accepted" && invite.user_id && invite.user_id !== user.id) {
    return { error: "This invite has already been claimed by another account." };
  }

  await admin
    .from("site_collaborators")
    .update({ user_id: user.id, status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", invite.id);

  const { data: site } = await admin
    .from("artist_sites")
    .select("name")
    .eq("id", invite.site_id)
    .single();

  revalidatePath("/my-site");
  return { siteId: invite.site_id, siteName: site?.name ?? "this site", role: invite.role as SiteRole };
}
