"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Split, Upload, Flag, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listChartOfAccounts } from "@/lib/actions/finance-accounts";
import { listFinanceProjects } from "@/lib/actions/finance-projects";
import {
  createManualTransaction,
  deleteManualTransaction,
  listTransactions,
  categorizeTransaction,
  flagTransactionForReview,
  resolveReviewFlag,
} from "@/lib/actions/finance-transactions";
import type { SplitInput } from "@/lib/finance/categorize";
import { CsvImportDialog } from "./CsvImportDialog";
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
  needs_review: boolean;
  review_note: string | null;
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
  const [showImport, setShowImport] = useState(false);

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

  // Single pass: every transaction lands in exactly one of these three
  // buckets, so there's no risk of a row appearing twice (or nowhere) as
  // new statuses/flags are added — instead of three independent .filter()
  // calls each re-stating overlapping conditions.
  const { needsReview, uncategorized, rest } = transactions.reduce(
    (buckets, t) => {
      if (t.needs_review) buckets.needsReview.push(t);
      else if (t.status === "uncategorized") buckets.uncategorized.push(t);
      else buckets.rest.push(t);
      return buckets;
    },
    { needsReview: [] as Transaction[], uncategorized: [] as Transaction[], rest: [] as Transaction[] }
  );
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
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
          <Upload size={14} className="mr-1" /> Import CSV
        </Button>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" /> Add transaction
        </Button>
      </div>

      {showImport && (
        <CsvImportDialog
          entityId={entity.id}
          accounts={accounts}
          onClose={() => setShowImport(false)}
          onImported={refresh}
        />
      )}

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

      {needsReview.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1.5">Needs your review ({needsReview.length})</p>
          <div className="rounded-xl border border-red-500/30 divide-y divide-[var(--border)]">
            {needsReview.map((t) => (
              <CategoryPickerRow key={t.id} transaction={t} accounts={accounts} projects={projects} entityId={entity.id} onDone={refresh} onDeleted={handleDelete} showReviewControls />
            ))}
          </div>
        </div>
      )}

      {uncategorized.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1.5">Needs categorizing ({uncategorized.length})</p>
          <div className="rounded-xl border border-amber-500/30 divide-y divide-[var(--border)]">
            {uncategorized.map((t) => (
              <CategoryPickerRow key={t.id} transaction={t} accounts={accounts} projects={projects} entityId={entity.id} onDone={refresh} showReviewControls={false} />
            ))}
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No transactions yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {rest.map((t) => (
            <TransactionRow key={t.id} transaction={t} entityId={entity.id} onDeleted={handleDelete} onFlagged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlagButton({ transactionId, entityId, onFlagged }: { transactionId: string; entityId: string; onFlagged: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await flagTransactionForReview(transactionId, entityId, note || undefined);
    setSaving(false);
    setOpen(false);
    setNote("");
    onFlagged();
  }

  if (open) {
    return (
      <div className="flex items-center gap-1">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-7 w-40 text-xs" />
        <button onClick={submit} disabled={saving} className="p-1 text-red-500 hover:text-red-600">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={() => setOpen(false)} className="p-1 text-[var(--muted-foreground)]"><X size={13} /></button>
      </div>
    );
  }

  return (
    <button onClick={() => setOpen(true)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500" title="Flag for review">
      <Flag size={14} />
    </button>
  );
}

function TransactionRow({
  transaction,
  entityId,
  onDeleted,
  onFlagged,
}: {
  transaction: Transaction;
  entityId: string;
  onDeleted: (id: string) => void;
  onFlagged: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div>
        <p className="text-sm font-medium">{transaction.payee_name}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{transaction.date} · {transaction.transaction_splits.length} categor{transaction.transaction_splits.length === 1 ? "y" : "ies"}</p>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-sm font-medium mr-2 ${transaction.amount >= 0 ? "text-green-600" : "text-red-500"}`}>{money(transaction.amount)}</span>
        <FlagButton transactionId={transaction.id} entityId={entityId} onFlagged={onFlagged} />
        {!transaction.bank_account_id && (
          <button onClick={() => onDeleted(transaction.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Shared by the "Needs categorizing" and "Needs your review" sections —
 * both are fundamentally "pick a category (and optionally a project) for
 * this transaction," differing only in whether a review note/current
 * category is shown and whether a plain "Resolved" (no re-categorization)
 * option is offered. Kept as one component so the two states can't quietly
 * drift apart (e.g. one offering delete/flag affordances the other lacks). */
function CategoryPickerRow({
  transaction,
  accounts,
  projects,
  entityId,
  onDone,
  onDeleted,
  showReviewControls,
}: {
  transaction: Transaction;
  accounts: Account[];
  projects: Project[];
  entityId: string;
  onDone: () => void;
  onDeleted?: (id: string) => void;
  showReviewControls: boolean;
}) {
  const [accountId, setAccountId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryAccounts = accounts.filter((a) => (transaction.amount >= 0 ? a.account_type === "income" : a.account_type === "expense") && a.is_active);
  const currentCategory = transaction.transaction_splits[0]
    ? accounts.find((a) => a.id === transaction.transaction_splits[0].chart_account_id)?.name
    : null;

  async function handleSave() {
    if (!accountId) {
      setError("Choose a category");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await categorizeTransaction(transaction.id, entityId, [
      { accountId, amount: Math.abs(transaction.amount), projectId: projectId || undefined },
    ]);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  async function handleResolve() {
    setResolving(true);
    await resolveReviewFlag(transaction.id, entityId);
    setResolving(false);
    onDone();
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-2 flex-wrap">
      <div>
        <p className="text-sm font-medium">{transaction.payee_name}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {transaction.date}{currentCategory ? ` · currently: ${currentCategory}` : ""}
        </p>
        {transaction.review_note && <p className="text-xs text-red-500 mt-0.5">"{transaction.review_note}"</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${transaction.amount >= 0 ? "text-green-600" : "text-red-500"}`}>{money(transaction.amount)}</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs">
          <option value="">{currentCategory ? "Change category..." : "Category..."}</option>
          {categoryAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs">
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
        </Button>
        {showReviewControls ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleResolve} disabled={resolving}>
            {resolving ? <Loader2 size={12} className="animate-spin" /> : "Resolved"}
          </Button>
        ) : (
          <FlagButton transactionId={transaction.id} entityId={entityId} onFlagged={onDone} />
        )}
        {onDeleted && !transaction.bank_account_id && (
          <button onClick={() => onDeleted(transaction.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 w-full">{error}</p>}
    </div>
  );
}
