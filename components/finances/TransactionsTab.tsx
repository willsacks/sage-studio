"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Plus, Trash2, Split, Upload, Flag, X, Check, StickyNote, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listChartOfAccounts, createChartAccount } from "@/lib/actions/finance-accounts";
import { listFinanceProjects, createFinanceProject } from "@/lib/actions/finance-projects";
import {
  createManualTransaction,
  deleteManualTransaction,
  listTransactions,
  categorizeTransaction,
  flagTransactionForReview,
  resolveReviewFlag,
  updateTransactionNote,
} from "@/lib/actions/finance-transactions";
import { getAiFinanceAssistantEnabled } from "@/lib/actions/finance-ai";
import type { SplitInput } from "@/lib/finance/categorize";
import { CsvImportDialog } from "./CsvImportDialog";
import { AiCategorizeAssistant } from "./AiCategorizeAssistant";
import type { FinanceEntity } from "./FinancesApp";
import { MONEY_ACCOUNT_SUBTYPES } from "@/lib/finance/default-accounts";

type Account = { id: string; name: string; account_type: string; account_subtype: string; is_active: boolean };
type Project = { id: string; name: string };
type Split = { accountId: string; amount: string; projectId: string };
type Transaction = {
  id: string;
  date: string;
  payee_name: string;
  amount: number;
  bank_account_id: string | null;
  money_account_id: string | null;
  status: string;
  needs_review: boolean;
  review_note: string | null;
  notes: string | null;
  bank_accounts?: { chart_account_id: string } | { chart_account_id: string }[] | null;
  transaction_splits: { chart_account_id: string; amount: number; project_id: string | null }[];
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** Server actions' inferred return types don't always narrow cleanly via a
 * plain `"error" in result` check once passed through the RSC boundary, so
 * this guard checks the value itself rather than relying on key presence. */
function actionFailed<T extends { error?: string }>(result: T): result is T & { error: string } {
  return typeof result.error === "string";
}

/** Resolves which money account (Cash/Bank/Credit Card chart-of-accounts
 * entry) a transaction belongs to — CSV/manual transactions carry
 * money_account_id directly, while Plaid-synced ones only know their
 * bank_accounts row, which maps to a chart account via chart_account_id. */
function resolvedAccountId(t: Transaction): string | null {
  if (t.money_account_id) return t.money_account_id;
  const bankAccount = Array.isArray(t.bank_accounts) ? t.bank_accounts[0] : t.bank_accounts;
  return bankAccount?.chart_account_id ?? null;
}

/** A category/project <select> that also offers an inline "+ New..." option
 * — picking it swaps the select for a small name input so the user can
 * create the category/project without leaving the transaction row, then
 * immediately selects the new one. */
function CreatableSelect({
  value,
  onChange,
  options,
  placeholder,
  newLabel,
  newPlaceholder,
  onCreate,
  className,
  extraField,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string; group?: string }[];
  placeholder: string;
  newLabel: string;
  newPlaceholder: string;
  onCreate: (name: string) => Promise<{ error: string } | { id: string }>;
  className: string;
  /** Rendered alongside the inline "add new" input — e.g. an income/expense
   * toggle when the list mixes both categories and the transaction's sign
   * alone can't tell you which type a new one should be (refunds). */
  extraField?: ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const result = await onCreate(trimmed);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onChange(result.id);
    setAdding(false);
    setName("");
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={newPlaceholder}
            className="h-8 text-xs w-36"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
              if (e.key === "Escape") { setAdding(false); setName(""); }
            }}
          />
          {extraField}
          <button onClick={handleAdd} disabled={saving} className="p-1 text-[var(--primary)] hover:opacity-80">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button onClick={() => { setAdding(false); setName(""); }} className="p-1 text-[var(--muted-foreground)]">
            <X size={13} />
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  const groups = Array.from(new Set(options.map((o) => o.group).filter((g): g is string => !!g)));

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") { setAdding(true); return; }
        onChange(e.target.value);
      }}
      className={className}
    >
      <option value="">{placeholder}</option>
      {groups.length > 0
        ? groups.map((g) => (
            <optgroup key={g} label={g}>
              {options.filter((o) => o.group === g).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </optgroup>
          ))
        : options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
      <option value="__new__">{newLabel}</option>
    </select>
  );
}

/** Inline note editor — a small icon that expands into a text field so
 * notes can be added without leaving the transaction row. */
function NoteButton({
  transactionId,
  entityId,
  note,
  onSaved,
}: {
  transactionId: string;
  entityId: string;
  note: string | null;
  onSaved: (note: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const result = await updateTransactionNote(transactionId, entityId, value);
    setSaving(false);
    if (!result.error) {
      setOpen(false);
      onSaved(value.trim() || null);
    }
  }

  if (open) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a note..."
          className="h-7 w-40 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <button onClick={submit} disabled={saving} className="p-1 text-[var(--primary)] hover:opacity-80">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={() => setOpen(false)} className="p-1 text-[var(--muted-foreground)]"><X size={13} /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className={`p-1.5 ${note ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"} hover:opacity-80`}
      title={note ?? "Add a note"}
    >
      <StickyNote size={14} />
    </button>
  );
}

const MONEY_SUBTYPES = MONEY_ACCOUNT_SUBTYPES;
type StatusFilter = "all" | "categorized" | "uncategorized";

export function TransactionsTab({ entity }: { entity: FinanceEntity }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [splits, setSplits] = useState<Split[]>([{ accountId: "", amount: "", projectId: "" }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountFilter, setAccountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetches the full transaction set once (all statuses, all dates) — the
  // account/status/date-range controls below all filter this in memory, so
  // switching between them is instant and never re-triggers the loading
  // spinner or a server round trip.
  // Doesn't touch `loading` — used when refetching behind an open dialog
  // (e.g. after a CSV import) that the user should keep seeing, including
  // its own success message. Toggling `loading` there would hit the early
  // `if (loading) return <spinner>` below and unmount the whole tab —
  // dialog included — making a successful import look like the "Import"
  // modal had silently popped back up with no confirmation, when it had
  // actually just been torn down and remounted fresh.
  const silentRefresh = useCallback(async () => {
    const [txnResult, accountsResult, projectsResult] = await Promise.all([
      listTransactions({ entityId: entity.id }),
      listChartOfAccounts(entity.id),
      listFinanceProjects(entity.id),
    ]);
    setTransactions((txnResult.transactions ?? []) as Transaction[]);
    setAccounts((accountsResult.accounts ?? []) as Account[]);
    setProjects((projectsResult.projects ?? []) as Project[]);
  }, [entity.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await silentRefresh();
    setLoading(false);
  }, [silentRefresh]);

  useEffect(() => {
    getAiFinanceAssistantEnabled().then(setAiAssistantEnabled);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function updateTransaction(id: string, patch: Partial<Transaction>) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTransaction(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  const moneyAccounts = accounts.filter((a) => MONEY_SUBTYPES.includes(a.account_subtype) && a.is_active);
  const categoryAccounts = accounts
    .filter((a) => (direction === "in" ? a.account_type === "income" : a.account_type === "expense") && a.is_active)
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredTransactions = transactions.filter((t) => {
    if (accountFilter && resolvedAccountId(t) !== accountFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    return true;
  });

  // Single pass: every transaction lands in exactly one of these three
  // buckets, so there's no risk of a row appearing twice (or nowhere) as
  // new statuses/flags are added — instead of three independent .filter()
  // calls each re-stating overlapping conditions. Transactions already
  // arrive sorted chronologically (newest first) from listTransactions.
  const { needsReview, uncategorized, rest } = filteredTransactions.reduce(
    (buckets, t) => {
      if (t.needs_review) buckets.needsReview.push(t);
      else if (t.status === "uncategorized") buckets.uncategorized.push(t);
      else buckets.rest.push(t);
      return buckets;
    },
    { needsReview: [] as Transaction[], uncategorized: [] as Transaction[], rest: [] as Transaction[] }
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
    removeTransaction(transactionId);
    await deleteManualTransaction(transactionId, entity.id);
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="">All accounts</option>
            {moneyAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="all">All</option>
            <option value="categorized">Categorized</option>
            <option value="uncategorized">Uncategorized</option>
          </select>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-36 text-sm" title="From date" />
          <span className="text-xs text-[var(--muted-foreground)]">to</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-36 text-sm" title="To date" />
        </div>
        <div className="flex gap-2">
          {aiAssistantEnabled && (
            <Button size="sm" variant="outline" onClick={() => setShowAiAssistant(true)}>
              <Sparkles size={14} className="mr-1" /> Ask AI to categorize
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} className="mr-1" /> Add transaction
          </Button>
        </div>
      </div>

      {showImport && (
        <CsvImportDialog
          entityId={entity.id}
          accounts={accounts}
          onClose={() => setShowImport(false)}
          onImported={silentRefresh}
        />
      )}

      {showAiAssistant && (
        <AiCategorizeAssistant
          entityId={entity.id}
          onClose={() => setShowAiAssistant(false)}
          onCategorized={silentRefresh}
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
                <CreatableSelect
                  value={s.accountId}
                  onChange={(id) => updateSplit(i, { accountId: id })}
                  options={categoryAccounts}
                  placeholder="Category..."
                  newLabel="+ New category..."
                  newPlaceholder={`New ${direction === "in" ? "income" : "expense"} category`}
                  onCreate={async (name): Promise<{ error: string } | { id: string }> => {
                    const result = await createChartAccount({
                      entityId: entity.id,
                      name,
                      accountType: direction === "in" ? "income" : "expense",
                      accountSubtype: "Other",
                    });
                    if (actionFailed(result)) return { error: result.error };
                    setAccounts((prev) => [
                      ...prev,
                      { id: result.accountId, name, account_type: direction === "in" ? "income" : "expense", account_subtype: "Other", is_active: true },
                    ]);
                    return { id: result.accountId };
                  }}
                  className="flex-1 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                />
                <CreatableSelect
                  value={s.projectId}
                  onChange={(id) => updateSplit(i, { projectId: id })}
                  options={projects}
                  placeholder="No project"
                  newLabel="+ New project..."
                  newPlaceholder="New project name"
                  onCreate={async (name): Promise<{ error: string } | { id: string }> => {
                    const result = await createFinanceProject({ entityId: entity.id, name });
                    if (actionFailed(result)) return { error: result.error };
                    setProjects((prev) => [...prev, { id: result.projectId, name }]);
                    return { id: result.projectId };
                  }}
                  className="w-40 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                />
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
              <CategoryPickerRow
                key={t.id}
                transaction={t}
                accounts={accounts}
                projects={projects}
                entityId={entity.id}
                onUpdated={updateTransaction}
                onDeleted={handleDelete}
                onAccountCreated={(a) => setAccounts((prev) => [...prev, a])}
                onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
                showReviewControls
              />
            ))}
          </div>
        </div>
      )}

      {uncategorized.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1.5">Needs categorizing ({uncategorized.length})</p>
          <div className="rounded-xl border border-amber-500/30 divide-y divide-[var(--border)]">
            {uncategorized.map((t) => (
              <CategoryPickerRow
                key={t.id}
                transaction={t}
                accounts={accounts}
                projects={projects}
                entityId={entity.id}
                onUpdated={updateTransaction}
                onAccountCreated={(a) => setAccounts((prev) => [...prev, a])}
                onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
                showReviewControls={false}
              />
            ))}
          </div>
        </div>
      )}

      {filteredTransactions.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No transactions yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {rest.map((t) =>
            editingCategoryId === t.id ? (
              <CategoryPickerRow
                key={t.id}
                transaction={t}
                accounts={accounts}
                projects={projects}
                entityId={entity.id}
                onUpdated={(id, patch) => { updateTransaction(id, patch); setEditingCategoryId(null); }}
                onDeleted={handleDelete}
                onAccountCreated={(a) => setAccounts((prev) => [...prev, a])}
                onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
                showReviewControls={false}
                onCancel={() => setEditingCategoryId(null)}
              />
            ) : (
              <TransactionRow
                key={t.id}
                transaction={t}
                entityId={entity.id}
                onDeleted={handleDelete}
                onFlagged={(patch) => updateTransaction(t.id, patch)}
                onNoteSaved={(note) => updateTransaction(t.id, { notes: note })}
                onEditCategory={() => setEditingCategoryId(t.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function FlagButton({ transactionId, entityId, onFlagged }: { transactionId: string; entityId: string; onFlagged: (patch: Partial<Transaction>) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const result = await flagTransactionForReview(transactionId, entityId, note || undefined);
    setSaving(false);
    setOpen(false);
    if (!result.error) {
      onFlagged({ needs_review: true, review_note: note.trim() || null });
    }
    setNote("");
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
  onNoteSaved,
  onEditCategory,
}: {
  transaction: Transaction;
  entityId: string;
  onDeleted: (id: string) => void;
  onFlagged: (patch: Partial<Transaction>) => void;
  onNoteSaved: (note: string | null) => void;
  onEditCategory: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" title={transaction.payee_name}>{transaction.payee_name}</p>
        <p className="text-xs text-[var(--muted-foreground)] truncate">
          {transaction.date} · {transaction.transaction_splits.length} categor{transaction.transaction_splits.length === 1 ? "y" : "ies"}
          {transaction.notes ? ` · "${transaction.notes}"` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-none whitespace-nowrap">
        <span className={`text-sm font-medium mr-2 ${transaction.amount >= 0 ? "text-green-600" : "text-red-500"}`}>{money(transaction.amount)}</span>
        <button onClick={onEditCategory} className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Change category">
          <Pencil size={14} />
        </button>
        <NoteButton transactionId={transaction.id} entityId={entityId} note={transaction.notes} onSaved={onNoteSaved} />
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
  onUpdated,
  onDeleted,
  onAccountCreated,
  onProjectCreated,
  showReviewControls,
  onCancel,
}: {
  transaction: Transaction;
  accounts: Account[];
  projects: Project[];
  entityId: string;
  onUpdated: (id: string, patch: Partial<Transaction>) => void;
  onDeleted?: (id: string) => void;
  onAccountCreated: (account: Account) => void;
  onProjectCreated: (project: Project) => void;
  showReviewControls: boolean;
  /** Present only when this picker is being used to edit an already-
   * categorized transaction's category (from the plain transaction list),
   * rather than in the always-open "needs categorizing"/"needs review"
   * sections — lets the user back out without saving a change. */
  onCancel?: () => void;
}) {
  // Pre-filled from the transaction's current split rather than starting
  // blank — otherwise re-opening an already-categorized transaction just
  // to add a project (without touching its category) incorrectly demands
  // the user re-pick a category before Save will do anything.
  const [accountId, setAccountId] = useState(transaction.transaction_splits[0]?.chart_account_id ?? "");
  const [projectId, setProjectId] = useState(transaction.transaction_splits[0]?.project_id ?? "");
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defaults the new-category type to the transaction's own sign, but stays
  // overridable — a refund flips the expected sign (e.g. money coming back
  // in from a return should land in an Expense category, not Income).
  const [newCategoryType, setNewCategoryType] = useState<"income" | "expense" | "transfer">(transaction.amount >= 0 ? "income" : "expense");

  // Both income and expense categories are shown, grouped — a positive
  // amount is usually income and a negative one an expense, but refunds
  // break that assumption in either direction, so the user needs to be able
  // to pick against the grain of the transaction's sign. A "Transfer" group
  // (other money accounts — savings, investment/retirement accounts like
  // Acorns, credit cards) is also offered: categorizing a transaction
  // against another money account rather than an income/expense category
  // is exactly what a transfer is, and the ledger already supports posting
  // a split against any account regardless of type — this was previously
  // just a UI gap, not a backend limitation.
  const ownMoneyAccountId = resolvedAccountId(transaction);
  const categoryAccounts = accounts
    .filter((a) => (a.account_type === "income" || a.account_type === "expense") && a.is_active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ id: a.id, name: a.name, group: a.account_type === "income" ? "Income" : "Expense" }));
  const transferAccounts = accounts
    .filter((a) => (a.account_type === "asset" || a.account_type === "liability") && a.is_active && a.id !== ownMoneyAccountId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ id: a.id, name: a.name, group: "Transfer" }));
  const categoryAndTransferAccounts = [...categoryAccounts, ...transferAccounts];
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
    onUpdated(transaction.id, {
      status: "categorized",
      needs_review: false,
      review_note: null,
      transaction_splits: [{ chart_account_id: accountId, amount: Math.abs(transaction.amount), project_id: projectId || null }],
    });
  }

  async function handleResolve() {
    setResolving(true);
    const result = await resolveReviewFlag(transaction.id, entityId);
    setResolving(false);
    if (!result.error) {
      onUpdated(transaction.id, { needs_review: false, review_note: null });
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" title={transaction.payee_name}>{transaction.payee_name}</p>
        <p className="text-xs text-[var(--muted-foreground)] truncate">
          {transaction.date}{currentCategory ? ` · currently: ${currentCategory}` : ""}
        </p>
        {transaction.review_note && <p className="text-xs text-red-500 mt-0.5 truncate">&quot;{transaction.review_note}&quot;</p>}
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
      <div className="flex items-center gap-2 flex-none flex-wrap justify-end">
        <span className={`text-sm font-medium ${transaction.amount >= 0 ? "text-green-600" : "text-red-500"}`}>{money(transaction.amount)}</span>
        <CreatableSelect
          value={accountId}
          onChange={setAccountId}
          options={categoryAndTransferAccounts}
          placeholder={currentCategory ? "Change category..." : "Category..."}
          newLabel="+ New category..."
          newPlaceholder={newCategoryType === "transfer" ? "New account (e.g. Acorns, 401k)" : `New ${newCategoryType} category`}
          onCreate={async (name): Promise<{ error: string } | { id: string }> => {
            const result =
              newCategoryType === "transfer"
                ? await createChartAccount({ entityId, name, accountType: "asset", accountSubtype: "Investment" })
                : await createChartAccount({ entityId, name, accountType: newCategoryType, accountSubtype: "Other" });
            if (actionFailed(result)) return { error: result.error };
            onAccountCreated({
              id: result.accountId,
              name,
              account_type: newCategoryType === "transfer" ? "asset" : newCategoryType,
              account_subtype: newCategoryType === "transfer" ? "Investment" : "Other",
              is_active: true,
            });
            return { id: result.accountId };
          }}
          extraField={
            <select
              value={newCategoryType}
              onChange={(e) => setNewCategoryType(e.target.value as "income" | "expense" | "transfer")}
              className="h-8 px-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer (new account)</option>
            </select>
          }
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        />
        <CreatableSelect
          value={projectId}
          onChange={setProjectId}
          options={projects}
          placeholder="No project"
          newLabel="+ New project..."
          newPlaceholder="New project name"
          onCreate={async (name): Promise<{ error: string } | { id: string }> => {
            const result = await createFinanceProject({ entityId, name });
            if (actionFailed(result)) return { error: result.error };
            onProjectCreated({ id: result.projectId, name });
            return { id: result.projectId };
          }}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        />
        <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
        </Button>
        {onCancel && (
          <button onClick={onCancel} className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Cancel">
            <X size={14} />
          </button>
        )}
        {showReviewControls ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleResolve} disabled={resolving}>
            {resolving ? <Loader2 size={12} className="animate-spin" /> : "Resolved"}
          </Button>
        ) : (
          <FlagButton transactionId={transaction.id} entityId={entityId} onFlagged={(patch) => onUpdated(transaction.id, patch)} />
        )}
        <NoteButton transactionId={transaction.id} entityId={entityId} note={transaction.notes} onSaved={(note) => onUpdated(transaction.id, { notes: note })} />
        {onDeleted && !transaction.bank_account_id && (
          <button onClick={() => onDeleted(transaction.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
