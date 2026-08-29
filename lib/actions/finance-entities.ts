"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultAccountsForEntityType, normalBalanceForType } from "@/lib/finance/default-accounts";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function listFinanceEntities() {
  const { supabase, user } = await requireAuth();

  // Entities the user owns AND entities they've been invited to as a
  // collaborator (e.g. a bookkeeper) — not just what they own.
  const [{ data: ownedEntities, error: ownedError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from("finance_entities").select("*").eq("owner_id", user.id),
    supabase.from("finance_entity_members").select("entity_id").eq("user_id", user.id).eq("status", "accepted"),
  ]);
  if (ownedError) return { error: ownedError.message, entities: [] };
  if (membershipsError) return { error: membershipsError.message, entities: [] };

  const memberEntityIds = (memberships ?? []).map((m) => m.entity_id);
  const { data: memberEntities, error: memberEntitiesError } = memberEntityIds.length
    ? await supabase.from("finance_entities").select("*").in("id", memberEntityIds)
    : { data: [], error: null };
  if (memberEntitiesError) return { error: memberEntitiesError.message, entities: [] };

  const entities = [...(ownedEntities ?? []), ...(memberEntities ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return { entities };
}

export async function createFinanceEntity(params: { name: string; entityType: "personal" | "business" }) {
  const { supabase, user } = await requireAuth();
  const name = params.name.trim();
  if (!name) return { error: "A name is required" };

  const { data: entity, error } = await supabase
    .from("finance_entities")
    .insert({ owner_id: user.id, name, entity_type: params.entityType })
    .select("id")
    .single();
  if (error || !entity) return { error: error?.message ?? "Failed to create entity" };

  const defaults = defaultAccountsForEntityType(params.entityType);
  const { error: accountsError } = await supabase.from("chart_of_accounts").insert(
    defaults.map((a) => ({
      entity_id: entity.id,
      name: a.name,
      account_type: a.account_type,
      account_subtype: a.account_subtype,
      normal_balance: normalBalanceForType(a.account_type),
      is_default: a.is_default ?? false,
      display_order: a.display_order,
    }))
  );
  if (accountsError) {
    await supabase.from("finance_entities").delete().eq("id", entity.id);
    return { error: `Failed to seed chart of accounts: ${accountsError.message}` };
  }

  revalidatePath("/finances");
  return { entityId: entity.id as string };
}

export async function renameFinanceEntity(entityId: string, name: string) {
  const { supabase, user } = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "A name is required" };

  const { error } = await supabase
    .from("finance_entities")
    .update({ name: trimmed })
    .eq("id", entityId)
    .eq("owner_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

export async function deleteFinanceEntity(entityId: string) {
  const { supabase, user } = await requireAuth();
  const { error } = await supabase
    .from("finance_entities")
    .delete()
    .eq("id", entityId)
    .eq("owner_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}
