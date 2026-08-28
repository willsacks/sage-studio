"use server";

import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { getBalanceSheet, getIncomeStatement, getProjectProfitability } from "@/lib/finance/reports";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function fetchBalanceSheet(entityId: string, asOfDate: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");
  try {
    return { report: await getBalanceSheet(supabase, entityId, asOfDate) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load balance sheet" };
  }
}

export async function fetchIncomeStatement(entityId: string, startDate: string, endDate: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");
  try {
    return { report: await getIncomeStatement(supabase, entityId, startDate, endDate) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load income statement" };
  }
}

export async function fetchProjectProfitability(entityId: string, startDate?: string, endDate?: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");
  try {
    return { projects: await getProjectProfitability(supabase, entityId, startDate, endDate) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load project profitability", projects: [] };
  }
}
