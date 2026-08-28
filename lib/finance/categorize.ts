import type { JournalLineInput } from "@/lib/finance/ledger";

export type SplitInput = { accountId: string; amount: number; projectId?: string; memo?: string };

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateSplits(splits: SplitInput[], amount: number): string | null {
  if (splits.length === 0) return "Choose at least one category";
  const total = round2(splits.reduce((sum, s) => sum + s.amount, 0));
  if (total !== round2(Math.abs(amount))) {
    return `Split amounts (${total}) must add up to the transaction amount (${Math.abs(amount)})`;
  }
  return null;
}

/** Builds the balanced journal-entry lines for a categorized transaction:
 * amount > 0 (cash in) debits the money account and credits each category
 * split (income); amount < 0 (cash out) credits the money account and
 * debits each category split (expense). Holds regardless of whether the
 * money account is an asset or a liability (credit card). Shared between
 * the manual-entry/categorize Server Actions and the Plaid sync job's
 * auto-categorization-by-rule path. */
export function buildJournalLines(moneyAccountId: string, amount: number, splits: SplitInput[]): JournalLineInput[] {
  const magnitude = Math.abs(amount);
  const moneyLine: JournalLineInput = amount > 0 ? { accountId: moneyAccountId, debit: magnitude } : { accountId: moneyAccountId, credit: magnitude };
  const categoryLines: JournalLineInput[] = splits.map((s) =>
    amount > 0
      ? { accountId: s.accountId, credit: s.amount, memo: s.memo }
      : { accountId: s.accountId, debit: s.amount, memo: s.memo }
  );
  return [moneyLine, ...categoryLines];
}
