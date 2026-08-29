import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { buildJournalLines, type SplitInput } from "@/lib/finance/categorize";

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
  sourceType: "manual" | "bank_transaction" | "opening_balance" | "invoice_payment" | "reconciliation_adjustment" | "import";
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

/**
 * Posts a fully-categorized transaction in one call: inserts the
 * `transactions` row, posts the balanced journal entry, inserts the
 * `transaction_splits`, and backfills `transactions.journal_entry_id`. This
 * is the same sequence `recordInvoicePayment` (lib/actions/finance-invoices.ts)
 * and `syncBankConnection` (lib/finance/plaid-sync.ts) each duplicate
 * inline — extracted here because the QuickBooks/Wave importer is a third
 * caller, at which point copy-pasting a third time stops being the
 * simpler option.
 */
export async function postImportedTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  input: {
    entityId: string;
    moneyAccountId: string;
    date: string;
    payeeName: string;
    amount: number;
    splits: SplitInput[];
    createdBy: string;
    sourceType?: "manual" | "bank_transaction" | "import";
  }
): Promise<{ transactionId: string; journalEntryId: string } | { error: string }> {
  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({
      entity_id: input.entityId,
      money_account_id: input.moneyAccountId,
      date: input.date,
      payee_name: input.payeeName,
      amount: input.amount,
      status: "categorized",
      is_split: input.splits.length > 1,
    })
    .select("id")
    .single();
  if (txnError || !txn) return { error: txnError?.message ?? "Failed to create transaction" };

  const posted = await postJournalEntry(supabase, {
    entityId: input.entityId,
    entryDate: input.date,
    description: input.payeeName,
    sourceType: input.sourceType ?? "import",
    sourceTransactionId: txn.id,
    createdBy: input.createdBy,
    lines: buildJournalLines(input.moneyAccountId, input.amount, input.splits),
  });
  if ("error" in posted) {
    await supabase.from("transactions").delete().eq("id", txn.id);
    return { error: posted.error };
  }

  const { error: splitsError } = await supabase.from("transaction_splits").insert(
    input.splits.map((s) => ({
      transaction_id: txn.id,
      chart_account_id: s.accountId,
      project_id: s.projectId ?? null,
      amount: s.amount,
      memo: s.memo ?? null,
    }))
  );
  if (splitsError) return { error: splitsError.message };

  await supabase.from("transactions").update({ journal_entry_id: posted.journalEntryId }).eq("id", txn.id);

  return { transactionId: txn.id as string, journalEntryId: posted.journalEntryId };
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
