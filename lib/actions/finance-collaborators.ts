"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole, type FinanceRole } from "@/lib/access/finance-access";
import type { FinanceCollaborator } from "@/lib/queries/finance-collaborators";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Shared by update/remove: both need "which entity does this collaborator
 * row belong to, and is the caller a manager of it" before touching the
 * row, so this is the one place that lookup+authorization happens rather
 * than each action repeating the same fetch-then-check. */
async function requireCollaboratorManagerAccess(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  userId: string,
  collaboratorId: string
): Promise<{ entityId: string } | { error: string }> {
  const { data: collaborator } = await supabase
    .from("finance_entity_members")
    .select("entity_id")
    .eq("id", collaboratorId)
    .single();
  if (!collaborator) return { error: "Collaborator not found" };

  await requireFinanceEntityRole(supabase, collaborator.entity_id, userId, "manager");
  return { entityId: collaborator.entity_id };
}

export async function listFinanceCollaborators(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("finance_entity_members")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message, collaborators: [] };
  return { collaborators: data ?? [] };
}

export async function inviteFinanceCollaborator(
  entityId: string,
  email: string,
  role: "viewer" | "editor" | "manager"
): Promise<{ error?: string; collaborator?: FinanceCollaborator }> {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "manager");

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return { error: "Enter a valid email address" };

  const { data, error } = await supabase
    .from("finance_entity_members")
    .insert({ entity_id: entityId, email: cleanEmail, role, invited_by: user.id, status: "pending" })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "This email has already been invited to these books" };
    return { error: error.message };
  }

  revalidatePath("/finances");
  return { collaborator: data };
}

export async function updateFinanceCollaboratorRole(collaboratorId: string, role: "viewer" | "editor" | "manager") {
  const { supabase, user } = await requireAuth();

  const access = await requireCollaboratorManagerAccess(supabase, user.id, collaboratorId);
  if ("error" in access) return access;

  const { data, error } = await supabase
    .from("finance_entity_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", collaboratorId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Not authorized to change this collaborator's role" };

  revalidatePath("/finances");
  return { success: true };
}

export async function removeFinanceCollaborator(collaboratorId: string) {
  const { supabase, user } = await requireAuth();

  const access = await requireCollaboratorManagerAccess(supabase, user.id, collaboratorId);
  if ("error" in access) return access;

  const { data, error } = await supabase.from("finance_entity_members").delete().eq("id", collaboratorId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Not authorized to remove this collaborator" };

  revalidatePath("/finances");
  return { success: true };
}

export async function acceptFinanceInvite(
  token: string
): Promise<{ entityId: string; entityName: string; role: FinanceRole } | { error: string }> {
  // Same pattern as site_collaborators' acceptInvite: a brand-new invitee
  // won't yet match any RLS policy, so the invite_token itself (via the
  // admin client) is what authorizes this one lookup/update.
  const { user } = await requireAuth();
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("finance_entity_members")
    .select("id, entity_id, role, status, user_id, email")
    .eq("invite_token", token)
    .single();

  if (!invite) return { error: "This invite link is invalid." };
  if (invite.status === "accepted" && invite.user_id && invite.user_id !== user.id) {
    return { error: "This invite has already been claimed by another account." };
  }
  if (invite.email && user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return { error: "This invite was sent to a different email address. Please log in with that email to accept it." };
  }

  await admin
    .from("finance_entity_members")
    .update({ user_id: user.id, status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", invite.id);

  const { data: entity } = await admin.from("finance_entities").select("name").eq("id", invite.entity_id).single();

  return { entityId: invite.entity_id, entityName: entity?.name ?? "these books", role: invite.role as FinanceRole };
}
