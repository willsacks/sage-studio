"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listChartOfAccounts } from "@/lib/actions/finance-accounts";
import { listFinanceProjects } from "@/lib/actions/finance-projects";
import { createManualTransaction, deleteManualTransaction, listTransactions, type SplitInput } from "@/lib/actions/finance-transactions";
import type { FinanceEntity } from "./FinancesApp";

type Account = { id: string; name: string; account_type: string; account_subtype: string; is_active: boolean };
type Project = { id: string; name: string };
type Split = { accountId: string; amount: string; projectId: string };
type Transaction = {
  id: string;
  date: string;
  payee_name: string;
  amount: number;
  bank_account_id: string | null;
  status: string;
  transaction_splits: { chart_account_id: string; amount: number; project_id: string | null }[];
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

const MONEY_SUBTYPES = ["Cash and Bank", "Credit Card"];

export function TransactionsTab({ entity }: { entity: FinanceEntity }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [splits, setSplits] = useState<Split[]>([{ accountId: "", amount: "", projectId: "" }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [txnResult, accountsResult, projectsResult] = await Promise.all([
      listTransactions({ entityId: entity.id }),
      listChartOfAccounts(entity.id),
      listFinanceProjects(entity.id),
    ]);
    setTransactions((txnResult.transactions ?? []) as Transaction[]);
    setAccounts((accountsResult.accounts ?? []) as Account[]);
    setProjects((projectsResult.projects ?? []) as Project[]);
    setLoading(false);
  }, [entity.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const moneyAccounts = accounts.filter((a) => MONEY_SUBTYPES.includes(a.account_subtype) && a.is_active);
  const categoryAccounts = accounts.filter(
    (a) => (direction === "in" ? a.account_type === "income" : a.account_type === "expense") && a.is_active
  );

  function updateSplit(index: number, patch: Partial<Split>) {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSplitRow() {
    setSplits((prev) => [...prev, { accountId: "", amount: "", projectId: "" }]);
  }

  function removeSplitRow(index: number) {
    setSplits((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    setError(null);
    const numericAmount = Number(amount);
    if (!payeeName.trim() || !numericAmount || !moneyAccountId) {
      setError("Fill in the description, amount, and account");
      return;
    }
    const parsedSplits: SplitInput[] = splits
      .filter((s) => s.accountId && s.amount)
      .map((s) => ({ accountId: s.accountId, amount: Number(s.amount), projectId: s.projectId || undefined }));
    if (parsedSplits.length === 0) {
      setError("Choose at least one category");
      return;
    }

    setCreating(true);
    const result = await createManualTransaction({
      entityId: entity.id,
      moneyAccountId,
      date,
      payeeName,
      amount: direction === "in" ? Math.abs(numericAmount) : -Math.abs(numericAmount),
      splits: parsedSplits,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPayeeName("");
    setAmount("");
    setSplits([{ accountId: "", amount: "", projectId: "" }]);
    setShowForm(false);
    refresh();
  }

  async function handleDelete(transactionId: string) {
    await deleteManualTransaction(transactionId, entity.id);
    refresh();
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" /> Add transaction
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Description</label>
              <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="e.g. Studio rental" className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Direction</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
                <option value="out">Money out</option>
                <option value="in">Money in</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Amount</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Account</label>
              <select value={moneyAccountId} onChange={(e) => setMoneyAccountId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
                <option value="">Choose...</option>
                {moneyAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Category{splits.length > 1 ? "s (split)" : ""}</label>
            {splits.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={s.accountId}
                  onChange={(e) => updateSplit(i, { accountId: e.target.value })}
                  className="flex-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                >
                  <option value="">Category...</option>
                  {categoryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <select
                  value={s.projectId}
                  onChange={(e) => updateSplit(i, { projectId: e.target.value })}
                  className="w-40 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={s.amount}
                  onChange={(e) => updateSplit(i, { amount: e.target.value })}
                  placeholder="0.00"
                  className="w-28 h-9 text-sm"
                />
                {splits.length > 1 && (
                  <button onClick={() => removeSplitRow(i)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addSplitRow} className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <Split size={12} /> Split across another category
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 size={13} className="animate-spin mr-1" />} Save transaction
          </Button>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No transactions yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{t.payee_name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{t.date} · {t.transaction_splits.length} categor{t.transaction_splits.length === 1 ? "y" : "ies"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>{money(t.amount)}</span>
                {!t.bank_account_id && (
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
