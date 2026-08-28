import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";

export type FinanceCollaborator = Tables<"finance_entity_members">;

export async function getCollaboratorsForEntity(entityId: string): Promise<FinanceCollaborator[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_entity_members")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) console.error("[getCollaboratorsForEntity]", error.message);
  return data ?? [];
}

export type FinanceInvitePreview = {
  entityId: string;
  entityName: string;
  role: "viewer" | "editor" | "manager";
  inviterName: string;
};

// Looked up before the visitor is authenticated, so it uses the service-role
// client — the invite_token itself is what authorizes reading this one row,
// same reasoning as site_collaborators' getInvitePreview.
export async function getFinanceInvitePreview(token: string): Promise<FinanceInvitePreview | null> {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("finance_entity_members")
    .select("entity_id, role, invited_by")
    .eq("invite_token", token)
    .single();
  if (!invite) return null;

  const [{ data: entity }, { data: inviter }] = await Promise.all([
    admin.from("finance_entities").select("name").eq("id", invite.entity_id).single(),
    admin.from("profiles").select("display_name, username").eq("id", invite.invited_by ?? "").maybeSingle(),
  ]);

  return {
    entityId: invite.entity_id,
    entityName: entity?.name ?? "these books",
    role: invite.role as "viewer" | "editor" | "manager",
    inviterName: inviter?.display_name || inviter?.username || "Someone",
  };
}
