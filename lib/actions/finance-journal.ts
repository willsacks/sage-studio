"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { postJournalEntry, reverseJournalEntry } from "@/lib/finance/ledger";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export type JournalEntryLineInput = { accountId: string; debit: number; credit: number };

/** Free-form debit/credit entry for accruals, depreciation, opening
 * balances, and other adjustments that aren't tied to a bank transaction —
 * the one gap `postJournalEntry` (lib/finance/ledger.ts) already supported
 * at the ledger layer but had no action/UI exposing it for. Posted with
 * source_type "manual" and no source_transaction_id, which is exactly what
 * distinguishes a free-standing journal entry from a manual transaction
 * (createManualTransaction also uses source_type "manual", but always with
 * a source_transaction_id) — that's how getAccountTransactions tells the two
 * apart when building a drilldown. */
export async function createJournalEntry(params: {
  entityId: string;
  date: string;
  memo?: string;
  lines: JournalEntryLineInput[];
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  const nonZeroLines = params.lines.filter((l) => l.debit > 0 || l.credit > 0);
  if (nonZeroLines.length < 2) return { error: "A journal entry needs at least two non-zero lines" };

  const posted = await postJournalEntry(supabase, {
    entityId: params.entityId,
    entryDate: params.date,
    description: params.memo?.trim() || undefined,
    sourceType: "manual",
    createdBy: user.id,
    lines: nonZeroLines.map((l) => ({
      accountId: l.accountId,
      debit: l.debit > 0 ? l.debit : undefined,
      credit: l.credit > 0 ? l.credit : undefined,
    })),
  });
  if ("error" in posted) return { error: posted.error };

  revalidatePath("/finances");
  return { journalEntryId: posted.journalEntryId };
}

/** Reverses a manual journal entry (accruals etc. posted via
 * createJournalEntry above) the same way deleteManualTransaction reverses a
 * transaction's entry — restricted to source_type "manual" entries with no
 * source_transaction_id, so this can't be used to unwind a bank-fed or
 * invoice-payment entry through the back door. */
export async function deleteJournalEntry(journalEntryId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("source_type, source_transaction_id")
    .eq("id", journalEntryId)
    .eq("entity_id", entityId)
    .single();
  if (!entry) return { error: "Journal entry not found" };
  if (entry.source_type !== "manual" || entry.source_transaction_id) {
    return { error: "Only manual journal entries can be deleted this way" };
  }

  const reversed = await reverseJournalEntry(supabase, journalEntryId, user.id);
  if ("error" in reversed) return { error: reversed.error };
  revalidatePath("/finances");
  return { success: true };
}
