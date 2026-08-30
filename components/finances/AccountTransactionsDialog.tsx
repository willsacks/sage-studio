"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchAccountTransactions } from "@/lib/actions/finance-reports";
import type { AccountTransaction } from "@/lib/finance/reports";
import { listChartOfAccounts } from "@/lib/actions/finance-accounts";
import { categorizeTransaction } from "@/lib/actions/finance-transactions";

type Account = { id: string; name: string; account_type: string; is_active: boolean };

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** Opened by clicking an account row on the Income Statement — shows every
 * transaction that landed in that account for the report's date range, with
 * an inline way to move a miscategorized one elsewhere without leaving the
 * report to go hunt it down on the Transactions tab. Recategorizing always
 * replaces the transaction's full set of splits with a single new category
 * (matching how the Transactions tab's own pencil-icon editor works) rather
 * than trying to edit one split out of a multi-split transaction in place. */
export function AccountTransactionsDialog({
  entityId,
  accountId,
  accountName,
  startDate,
  endDate,
  onClose,
  onChanged,
}: {
  entityId: string;
  accountId: string;
  accountName: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAccountId, setNewAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changedAny, setChangedAny] = useState(false);

  useEffect(() => {
    Promise.all([fetchAccountTransactions(entityId, accountId, startDate, endDate), listChartOfAccounts(entityId)]).then(
      ([txnResult, accountsResult]) => {
        setTransactions(txnResult.transactions ?? []);
        setAccounts(((accountsResult.accounts ?? []) as Account[]).filter((a) => a.is_active));
        setLoading(false);
      }
    );
  }, [entityId, accountId, startDate, endDate]);

  const categoryAccounts = accounts
    .filter((a) => a.account_type === "income" || a.account_type === "expense")
    .sort((a, b) => a.name.localeCompare(b.name));

  function startEdit(t: AccountTransaction) {
    setEditingId(t.id);
    setNewAccountId("");
    setError(null);
  }

  async function handleSave(t: AccountTransaction) {
    if (!newAccountId) {
      setError("Choose a category");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await categorizeTransaction(t.id, entityId, [{ accountId: newAccountId, amount: Math.abs(t.amount) }]);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Moved out of the account this dialog is showing, so it drops off the
    // list here — the report totals themselves refresh via onChanged once
    // the dialog closes (or immediately, so the number behind it is already
    // right if the user keeps recategorizing more rows before closing).
    setTransactions((prev) => prev.filter((x) => x.id !== t.id));
    setEditingId(null);
    setChangedAny(true);
    onChanged();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[32rem] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-[var(--border)]">
          <DialogTitle>{accountName}</DialogTitle>
          <DialogDescription>
            {startDate} – {endDate} · recategorize anything that doesn&apos;t belong here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">
              {changedAny ? "Nothing left in this account for this period." : "No transactions in this account for this period."}
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {transactions.map((t) => (
                <div key={t.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium">{t.payeeName}</p>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t.date}{t.isSplit ? " · split transaction" : ""}
                    </p>
                    <span className="text-sm font-medium flex-none">{money(t.splitAmount)}</span>
                  </div>
                  {editingId === t.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={newAccountId}
                        onChange={(e) => setNewAccountId(e.target.value)}
                        className="h-8 flex-1 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
                      >
                        <option value="">Choose category...</option>
                        {categoryAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <Button size="sm" className="h-8 text-xs" onClick={() => handleSave(t)} disabled={saving}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </Button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-[var(--muted-foreground)] px-1">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(t)} className="text-xs text-[var(--primary)] mt-1 hover:underline">
                      Recategorize
                    </button>
                  )}
                  {editingId === t.id && error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
