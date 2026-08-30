"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { applyRuleToExistingTransactions, type CategorizationRule } from "@/lib/finance/categorization-rules";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function listCategorizationRules(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("entity_id", entityId)
    .order("priority", { ascending: true });
  if (error) return { error: error.message, rules: [] };
  return { rules: data ?? [] };
}

export async function createCategorizationRule(params: {
  entityId: string;
  matchType: "contains" | "exact" | "starts_with";
  matchValue: string;
  chartAccountId: string;
  defaultProjectId?: string;
  priority?: number;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  const matchValue = params.matchValue.trim();
  if (!matchValue) return { error: "A match value is required" };

  const { error } = await supabase.from("categorization_rules").insert({
    entity_id: params.entityId,
    match_type: params.matchType,
    match_value: matchValue,
    chart_account_id: params.chartAccountId,
    default_project_id: params.defaultProjectId ?? null,
    priority: params.priority ?? 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

/** Runs every one of the entity's existing rules against transactions that
 * are already sitting uncategorized — rules only ever helped *future*
 * transactions until now (auto-categorization only ran at Plaid-sync/CSV-
 * import time), silently doing nothing for the backlog that usually
 * prompts creating a rule in the first place. */
export async function applyRulesToExistingTransactions(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: rules, error } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("entity_id", entityId)
    .order("priority", { ascending: true });
  if (error) return { error: error.message };

  let matchedCount = 0;
  for (const rule of (rules ?? []) as CategorizationRule[]) {
    const result = await applyRuleToExistingTransactions(supabase, { entityId, rule });
    matchedCount += result.matchedCount;
  }

  revalidatePath("/finances");
  return { matchedCount };
}

export async function deleteCategorizationRule(ruleId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("categorization_rules").delete().eq("id", ruleId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}
