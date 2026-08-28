import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";

export type FinanceRole = "owner" | "manager" | "editor" | "viewer";

const RANK: Record<FinanceRole, number> = { viewer: 0, editor: 1, manager: 2, owner: 3 };

export function hasAtLeastFinanceRole(role: FinanceRole | null, min: FinanceRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export async function getFinanceEntityRole(
  supabase: SupabaseClient<Database>,
  entityId: string,
  userId: string
): Promise<FinanceRole | null> {
  const { data: entity } = await supabase
    .from("finance_entities")
    .select("owner_id")
    .eq("id", entityId)
    .single();
  if (!entity) return null;
  if (entity.owner_id === userId) return "owner";

  const { data: member } = await supabase
    .from("finance_entity_members")
    .select("role")
    .eq("entity_id", entityId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  return member?.role ?? null;
}

export async function requireFinanceEntityRole(
  supabase: SupabaseClient<Database>,
  entityId: string,
  userId: string,
  min: FinanceRole
): Promise<FinanceRole> {
  const role = await getFinanceEntityRole(supabase, entityId, userId);
  if (!hasAtLeastFinanceRole(role, min)) throw new Error("Not authorized");
  return role!;
}
