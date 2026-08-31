"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { normalBalanceForType } from "@/lib/finance/default-accounts";
import { logFinanceAudit } from "@/lib/finance/audit";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function listChartOfAccounts(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("entity_id", entityId)
    .order("display_order", { ascending: true });
  if (error) return { error: error.message, accounts: [] };
  return { accounts: data ?? [] };
}

export async function createChartAccount(params: {
  entityId: string;
  name: string;
  accountType: "asset" | "liability" | "equity" | "income" | "expense";
  accountSubtype: string;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  const name = params.name.trim();
  if (!name) return { error: "A name is required" };

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .insert({
      entity_id: params.entityId,
      name,
      account_type: params.accountType,
      account_subtype: params.accountSubtype.trim() || "Other",
      normal_balance: normalBalanceForType(params.accountType),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: user.id,
    action: "account.created",
    targetTable: "chart_of_accounts",
    targetId: data.id as string,
    diff: { name, accountType: params.accountType, accountSubtype: params.accountSubtype },
  });
  revalidatePath("/finances");
  return { accountId: data.id as string };
}

export async function renameChartAccount(accountId: string, entityId: string, name: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const trimmed = name.trim();
  if (!trimmed) return { error: "A name is required" };

  const { error } = await supabase.from("chart_of_accounts").update({ name: trimmed }).eq("id", accountId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  await logFinanceAudit(supabase, { entityId, actorId: user.id, action: "account.renamed", targetTable: "chart_of_accounts", targetId: accountId, diff: { name: trimmed } });
  revalidatePath("/finances");
  return { success: true };
}

export async function setChartAccountActive(accountId: string, entityId: string, isActive: boolean) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("chart_of_accounts").update({ is_active: isActive }).eq("id", accountId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  await logFinanceAudit(supabase, {
    entityId,
    actorId: user.id,
    action: isActive ? "account.reactivated" : "account.archived",
    targetTable: "chart_of_accounts",
    targetId: accountId,
  });
  revalidatePath("/finances");
  return { success: true };
}
