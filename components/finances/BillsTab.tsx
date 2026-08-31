"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Ban, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listBills, createBill, setBillStatus, recordBillPayment, type BillLineItemInput } from "@/lib/actions/finance-bills";
import { listChartOfAccounts } from "@/lib/actions/finance-accounts";
import { listFinanceProjects } from "@/lib/actions/finance-projects";
import type { FinanceEntity } from "./FinancesApp";
import { MONEY_ACCOUNT_SUBTYPES } from "@/lib/finance/default-accounts";

type LineItemRow = { description: string; accountId: string; amount: string };
type Bill = {
  id: string;
  bill_number: string;
  vendor_name: string;
  status: "open" | "partial" | "paid" | "void";
  total: number;
  bill_date: string;
  due_date: string | null;
  project_id: string | null;
  bill_payments: { amount: number }[];
};
type Account = { id: string; name: string; account_subtype: string; account_type: string };
type Project = { id: string; name: string };

const STATUS_STYLES: Record<string, string> = {
  open: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  partial: "bg-amber-500/10 text-amber-600",
  paid: "bg-green-500/10 text-green-600",
  void: "bg-[var(--muted)] text-[var(--muted-foreground)] line-through",
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** Accounts payable — vendor bills owed that aren't just bank-fed expenses
 * (invoiced by a vendor, paid later). Mirrors InvoicesTab's structure
 * exactly: a bill is a lightweight tracking layer, only recording a
 * payment touches the ledger. The one real difference from an invoice is
 * that each line item carries its own expense account (a payment needs to
 * know what to debit), not just a description. */
export function BillsTab({ entity }: { entity: FinanceEntity }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);

  const [vendorName, setVendorName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<LineItemRow[]>([{ description: "", accountId: "", amount: "" }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [billsResult, accountsResult, projectsResult] = await Promise.all([
      listBills(entity.id),
      listChartOfAccounts(entity.id),
      listFinanceProjects(entity.id),
    ]);
    setBills((billsResult.bills ?? []) as Bill[]);
    setAccounts((accountsResult.accounts ?? []) as Account[]);
    setProjects((projectsResult.projects ?? []) as Project[]);
    setLoading(false);
  }, [entity.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const expenseAccounts = accounts.filter((a) => a.account_type === "expense").sort((a, b) => a.name.localeCompare(b.name));

  function updateLineItem(i: number, patch: Partial<LineItemRow>) {
    setLineItems((prev) => prev.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));
  }
  function addLineItem() {
    setLineItems((prev) => [...prev, { description: "", accountId: "", amount: "" }]);
  }
  function removeLineItem(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    setError(null);
    if (!vendorName.trim()) {
      setError("A vendor name is required");
      return;
    }
    const parsed: BillLineItemInput[] = lineItems
      .filter((li) => li.accountId && li.amount)
      .map((li) => ({ description: li.description, accountId: li.accountId, amount: Number(li.amount) }));
    if (parsed.length === 0) {
      setError("Add at least one line item with a category and amount");
      return;
    }

    setCreating(true);
    const result = await createBill({
      entityId: entity.id,
      projectId: projectId || undefined,
      vendorName,
      billDate,
      dueDate: dueDate || undefined,
      lineItems: parsed,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setVendorName("");
    setProjectId("");
    setDueDate("");
    setLineItems([{ description: "", accountId: "", amount: "" }]);
    setShowForm(false);
    refresh();
  }

  async function handleVoid(billId: string) {
    await setBillStatus(billId, entity.id, "void");
    refresh();
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" /> New bill
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Vendor name</label>
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Project (optional)</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Bill date</label>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Due date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Line items</label>
            {lineItems.map((li, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={li.description} onChange={(e) => updateLineItem(i, { description: e.target.value })} placeholder="Description" className="flex-1 h-9 text-sm" />
                <select
                  value={li.accountId}
                  onChange={(e) => updateLineItem(i, { accountId: e.target.value })}
                  className="w-40 h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                >
                  <option value="">Category...</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <Input type="number" value={li.amount} onChange={(e) => updateLineItem(i, { amount: e.target.value })} placeholder="Amount" className="w-28 h-9 text-sm" />
                {lineItems.length > 1 && (
                  <button onClick={() => removeLineItem(i)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addLineItem} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">+ Add line item</button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 size={13} className="animate-spin mr-1" />} Create bill
          </Button>
        </div>
      )}

      {bills.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No bills yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {bills.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{b.bill_number} — {b.vendor_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status]}`}>{b.status}</span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">{b.bill_date}{b.due_date ? ` · Due ${b.due_date}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{money(b.total)}</span>
                {b.status !== "paid" && b.status !== "void" && (
                  <>
                    <button onClick={() => setPayingBill(b)} className="p-1.5 text-[var(--muted-foreground)] hover:text-green-600" title="Record payment">
                      <DollarSign size={14} />
                    </button>
                    <button onClick={() => handleVoid(b.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500" title="Void bill">
                      <Ban size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {payingBill && (
        <RecordBillPaymentDialog
          entityId={entity.id}
          bill={payingBill}
          accounts={accounts}
          onClose={() => setPayingBill(null)}
          onRecorded={() => {
            setPayingBill(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function RecordBillPaymentDialog({
  entityId,
  bill,
  accounts,
  onClose,
  onRecorded,
}: {
  entityId: string;
  bill: Bill;
  accounts: Account[];
  onClose: () => void;
  onRecorded: () => void;
}) {
  const paidSoFar = bill.bill_payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, bill.total - paidSoFar);

  const [amount, setAmount] = useState(String(remaining));
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moneyAccounts = accounts.filter((a) => MONEY_ACCOUNT_SUBTYPES.includes(a.account_subtype));

  async function handleSave() {
    if (!moneyAccountId || !Number(amount)) {
      setError("Fill in the amount and the account paid from");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await recordBillPayment({
      billId: bill.id,
      entityId,
      amount: Number(amount),
      paidDate,
      moneyAccountId,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onRecorded();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm space-y-3">
        <DialogHeader>
          <DialogTitle>Record payment — {bill.bill_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Amount</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Date paid</label>
          <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Paid from</label>
          <select value={moneyAccountId} onChange={(e) => setMoneyAccountId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="">Choose...</option>
            {moneyAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin mr-1" />} Save payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
