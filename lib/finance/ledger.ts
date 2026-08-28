import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";

export type JournalLineInput = {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string;
};

export type PostJournalEntryInput = {
  entityId: string;
  entryDate: string;
  description?: string;
  sourceType: "manual" | "bank_transaction" | "opening_balance" | "invoice_payment" | "reconciliation_adjustment";
  sourceTransactionId?: string;
  createdBy: string;
  lines: JournalLineInput[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The one writer every categorization/invoice-payment/reconciliation action
 * goes through. Validates the balance invariant server-side even though the
 * DB also has a trigger backstop — Server Action arguments are
 * attacker-controlled input, not trusted just because the UI validated them.
 */
export async function postJournalEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  input: PostJournalEntryInput
): Promise<{ journalEntryId: string } | { error: string }> {
  if (input.lines.length < 2) return { error: "A journal entry needs at least two lines" };

  const totalDebit = round2(input.lines.reduce((sum, l) => sum + (l.debit ?? 0), 0));
  const totalCredit = round2(input.lines.reduce((sum, l) => sum + (l.credit ?? 0), 0));
  if (totalDebit !== totalCredit) {
    return { error: `Journal entry does not balance (debits ${totalDebit} vs credits ${totalCredit})` };
  }
  for (const line of input.lines) {
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      return { error: "Each journal line must be either a debit or a credit, not both/neither" };
    }
  }

  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      entity_id: input.entityId,
      entry_date: input.entryDate,
      description: input.description ?? null,
      source_type: input.sourceType,
      source_transaction_id: input.sourceTransactionId ?? null,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (entryError || !entry) return { error: entryError?.message ?? "Failed to create journal entry" };

  const { error: linesError } = await supabase.from("journal_entry_lines").insert(
    input.lines.map((l) => ({
      journal_entry_id: entry.id,
      account_id: l.accountId,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
      memo: l.memo ?? null,
    }))
  );

  if (linesError) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return { error: linesError.message };
  }

  return { journalEntryId: entry.id as string };
}

/** Reverses a journal entry by posting an equal-and-opposite entry, rather
 * than deleting it — preserves history and keeps is_locked entries auditable
 * even after their underlying transaction is re-categorized. */
export async function reverseJournalEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  journalEntryId: string,
  createdBy: string
): Promise<{ journalEntryId: string } | { error: string }> {
  const { data: original, error: fetchError } = await supabase
    .from("journal_entries")
    .select("entity_id, entry_date, description, source_type, is_locked, journal_entry_lines(account_id, debit, credit, memo)")
    .eq("id", journalEntryId)
    .single();

  if (fetchError || !original) return { error: fetchError?.message ?? "Journal entry not found" };
  if (original.is_locked) return { error: "This entry is locked by a completed reconciliation" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines = (original as any).journal_entry_lines as { account_id: string; debit: number; credit: number; memo: string | null }[];

  return postJournalEntry(supabase, {
    entityId: original.entity_id,
    entryDate: original.entry_date,
    description: original.description ? `Reversal: ${original.description}` : "Reversal",
    sourceType: original.source_type,
    createdBy,
    lines: lines.map((l) => ({
      accountId: l.account_id,
      debit: l.credit,
      credit: l.debit,
      memo: l.memo ?? undefined,
    })),
  });
}
