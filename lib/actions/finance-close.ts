"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Owner-only: closes the books through (and including) the given date.
 * Enforced at the single ledger chokepoint (postJournalEntry,
 * lib/finance/ledger.ts) rather than here — this action just sets the date. */
export async function closeBooksThrough(entityId: string, date: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "owner");
  if (!date) return { error: "A date is required" };

  const { error } = await supabase.from("finance_entities").update({ locked_through_date: date }).eq("id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

/** Owner-only: fully reopens the books (clears the lock). No partial
 * "reopen through an earlier date" option in v1 — if a fix is needed, reopen
 * fully, make it, and close again through the same or a later date. */
export async function reopenBooks(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "owner");

  const { error } = await supabase.from("finance_entities").update({ locked_through_date: null }).eq("id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

export async function getBooksLockStatus(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase.from("finance_entities").select("locked_through_date").eq("id", entityId).single();
  if (error) return { error: error.message };
  return { lockedThroughDate: (data?.locked_through_date as string | null) ?? null };
}
