"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listChartOfAccounts } from "@/lib/actions/finance-accounts";
import { createJournalEntry } from "@/lib/actions/finance-journal";
import { today } from "./DateRangePicker";

type Account = { id: string; name: string; account_type: string; is_active: boolean };

type Line = { accountId: string; debit: string; credit: string };

const BLANK_LINES: Line[] = [
  { accountId: "", debit: "", credit: "" },
  { accountId: "", debit: "", credit: "" },
];

function parseAmount(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Free-form debit/credit entry form for accruals, depreciation, opening
 * balances, and other month-end adjustments that don't come from the bank
 * feed. Opened from the Reports tab; posts via createJournalEntry
 * (lib/actions/finance-journal.ts), which is a thin balance-checked wrapper
 * around the same postJournalEntry every other posting path already uses. */
export function JournalEntryDialog({
  entityId,
  onClose,
  onPosted,
}: {
  entityId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>(BLANK_LINES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postedCount, setPostedCount] = useState(0);

  useEffect(() => {
    listChartOfAccounts(entityId).then((r) => {
      setAccounts(((r.accounts ?? []) as Account[]).filter((a) => a.is_active).sort((a, b) => a.name.localeCompare(b.name)));
      setLoadingAccounts(false);
    });
  }, [entityId]);

  const totalDebit = lines.reduce((sum, l) => sum + parseAmount(l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => sum + parseAmount(l.credit), 0);
  const nonZeroLines = lines.filter((l) => parseAmount(l.debit) > 0 || parseAmount(l.credit) > 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;
  const canSave = balanced && nonZeroLines.length >= 2 && nonZeroLines.every((l) => l.accountId);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function setDebit(i: number, value: string) {
    updateLine(i, { debit: value, credit: value ? "" : lines[i].credit });
  }

  function setCredit(i: number, value: string) {
    updateLine(i, { credit: value, debit: value ? "" : lines[i].debit });
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: "", debit: "", credit: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await createJournalEntry({
      entityId,
      date,
      memo,
      lines: nonZeroLines.map((l) => ({ accountId: l.accountId, debit: parseAmount(l.debit), credit: parseAmount(l.credit) })),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPostedCount((c) => c + 1);
    setMemo("");
    setLines(BLANK_LINES);
    onPosted();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[36rem] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-[var(--border)]">
          <DialogTitle>New journal entry</DialogTitle>
          <DialogDescription>
            For accruals, depreciation, opening balances, and other adjustments — debits must equal credits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loadingAccounts ? (
            <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
                />
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Memo (optional)"
                  className="h-8 flex-1 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_5.5rem_5.5rem_1.5rem] gap-1.5 text-xs text-[var(--muted-foreground)] px-0.5">
                  <span>Account</span>
                  <span className="text-right">Debit</span>
                  <span className="text-right">Credit</span>
                  <span />
                </div>
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5.5rem_5.5rem_1.5rem] gap-1.5 items-center">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(i, { accountId: e.target.value })}
                      className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs min-w-0"
                    >
                      <option value="">Choose account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      onChange={(e) => setDebit(i, e.target.value)}
                      className="h-8 px-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs text-right"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(e) => setCredit(i, e.target.value)}
                      className="h-8 px-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs text-right"
                    />
                    <button
                      onClick={() => removeLine(i)}
                      disabled={lines.length <= 2}
                      className="text-[var(--muted-foreground)] disabled:opacity-30 flex justify-center"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button onClick={addLine} className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1 mt-0.5">
                  <Plus size={12} /> Add line
                </button>
              </div>

              <div className="flex justify-between text-xs pt-2 border-t border-[var(--border)]">
                <span className={totalDebit !== totalCredit ? "text-red-500" : "text-[var(--muted-foreground)]"}>
                  Debits {totalDebit.toFixed(2)} / Credits {totalCredit.toFixed(2)}
                </span>
                {balanced && <span className="text-green-600">Balanced</span>}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
              {postedCount > 0 && !error && (
                <p className="text-xs text-green-600">
                  {postedCount} {postedCount === 1 ? "entry" : "entries"} posted this session.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={onClose}>Done</Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Post entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
