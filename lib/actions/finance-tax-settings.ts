"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { getIncomeStatement } from "@/lib/finance/reports";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function getTaxSettings(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data } = await supabase.from("finance_tax_settings").select("*").eq("entity_id", entityId).maybeSingle();
  return { settings: data ?? { entity_id: entityId, reserve_percentage: 27, tax_year_start_month: 1 } };
}

export async function setTaxReservePercentage(entityId: string, reservePercentage: number) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  if (reservePercentage < 0 || reservePercentage > 100) return { error: "Enter a percentage between 0 and 100" };

  const { error } = await supabase
    .from("finance_tax_settings")
    .upsert({ entity_id: entityId, reserve_percentage: reservePercentage }, { onConflict: "entity_id" });
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

/** Estimate only — not tax advice. Cumulative net income since the start of
 * the entity's tax year × the configured reserve percentage, with the four
 * IRS quarterly estimated-payment windows shown purely as a display
 * convenience for US calendar-year filers. */
export async function getTaxSetAsideEstimate(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data: settings } = await supabase.from("finance_tax_settings").select("*").eq("entity_id", entityId).maybeSingle();
  const reservePercentage = settings?.reserve_percentage ?? 27;
  const taxYearStartMonth = settings?.tax_year_start_month ?? 1;

  const now = new Date();
  const yearStart = now.getUTCMonth() + 1 >= taxYearStartMonth ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const startDate = `${yearStart}-${String(taxYearStartMonth).padStart(2, "0")}-01`;
  const endDate = now.toISOString().slice(0, 10);

  const incomeStatement = await getIncomeStatement(supabase, entityId, startDate, endDate);
  const recommendedReserve = Math.round(Math.max(0, incomeStatement.netIncome) * (reservePercentage / 100) * 100) / 100;

  return {
    startDate,
    endDate,
    netIncome: incomeStatement.netIncome,
    reservePercentage,
    recommendedReserve,
  };
}
