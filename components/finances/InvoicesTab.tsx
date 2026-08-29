"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, FileText, Send, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listInvoices, createInvoice, setInvoiceStatus, recordInvoicePayment, type InvoiceLineItemInput } from "@/lib/actions/finance-invoices";
import { listChartOfAccounts } from "@/lib/actions/finance-accounts";
import { listFinanceProjects } from "@/lib/actions/finance-projects";
import type { FinanceEntity } from "./FinancesApp";

type LineItemRow = { description: string; quantity: string; unitPrice: string };
type Invoice = {
  id: string;
  invoice_number: string;
  client_name: string;
  status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
  total: number;
  issue_date: string;
  due_date: string | null;
  project_id: string | null;
  invoice_payments: { amount: number }[];
};
type Account = { id: string; name: string; account_subtype: string; account_type: string };
type Project = { id: string; name: string };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  sent: "bg-blue-500/10 text-blue-600",
  partial: "bg-amber-500/10 text-amber-600",
  paid: "bg-green-500/10 text-green-600",
  overdue: "bg-red-500/10 text-red-600",
  void: "bg-[var(--muted)] text-[var(--muted-foreground)] line-through",
};

const MONEY_SUBTYPES = ["Cash and Bank", "Credit Card"];

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function InvoicesTab({ entity }: { entity: FinanceEntity }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<LineItemRow[]>([{ description: "", quantity: "1", unitPrice: "" }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [invoicesResult, accountsResult, projectsResult] = await Promise.all([
      listInvoices(entity.id),
      listChartOfAccounts(entity.id),
      listFinanceProjects(entity.id),
    ]);
    setInvoices((invoicesResult.invoices ?? []) as Invoice[]);
    setAccounts((accountsResult.accounts ?? []) as Account[]);
    setProjects((projectsResult.projects ?? []) as Project[]);
    setLoading(false);
  }, [entity.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function updateLineItem(i: number, patch: Partial<LineItemRow>) {
    setLineItems((prev) => prev.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));
  }
  function addLineItem() {
    setLineItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }
  function removeLineItem(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    setError(null);
    if (!clientName.trim()) {
      setError("A client name is required");
      return;
    }
    const parsed: InvoiceLineItemInput[] = lineItems
      .filter((li) => li.description.trim() && li.unitPrice)
      .map((li) => ({ description: li.description, quantity: Number(li.quantity) || 1, unitPrice: Number(li.unitPrice) }));
    if (parsed.length === 0) {
      setError("Add at least one line item");
      return;
    }

    setCreating(true);
    const result = await createInvoice({
      entityId: entity.id,
      projectId: projectId || undefined,
      clientName,
      clientEmail: clientEmail || undefined,
      issueDate,
      dueDate: dueDate || undefined,
      lineItems: parsed,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setClientName("");
    setClientEmail("");
    setProjectId("");
    setDueDate("");
    setLineItems([{ description: "", quantity: "1", unitPrice: "" }]);
    setShowForm(false);
    refresh();
  }

  async function handleSend(invoiceId: string) {
    await setInvoiceStatus(invoiceId, entity.id, "sent");
    refresh();
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" /> New invoice
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Client name</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Client email (optional)</label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="h-9 text-sm" />
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Issue date</label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Due date</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Line items</label>
            {lineItems.map((li, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={li.description} onChange={(e) => updateLineItem(i, { description: e.target.value })} placeholder="Description" className="flex-1 h-9 text-sm" />
                <Input type="number" value={li.quantity} onChange={(e) => updateLineItem(i, { quantity: e.target.value })} placeholder="Qty" className="w-20 h-9 text-sm" />
                <Input type="number" value={li.unitPrice} onChange={(e) => updateLineItem(i, { unitPrice: e.target.value })} placeholder="Rate" className="w-28 h-9 text-sm" />
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
            {creating && <Loader2 size={13} className="animate-spin mr-1" />} Create invoice
          </Button>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No invoices yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{inv.invoice_number} — {inv.client_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">{inv.issue_date}{inv.due_date ? ` · Due ${inv.due_date}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{money(inv.total)}</span>
                <a href={`/api/finance/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <FileText size={14} />
                </a>
                {inv.status === "draft" && (
                  <button onClick={() => handleSend(inv.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Mark as sent">
                    <Send size={14} />
                  </button>
                )}
                {inv.status !== "paid" && inv.status !== "void" && (
                  <button onClick={() => setPayingInvoice(inv)} className="p-1.5 text-[var(--muted-foreground)] hover:text-green-600" title="Record payment">
                    <DollarSign size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {payingInvoice && (
        <RecordPaymentDialog
          entityId={entity.id}
          invoice={payingInvoice}
          accounts={accounts}
          onClose={() => setPayingInvoice(null)}
          onRecorded={() => {
            setPayingInvoice(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function RecordPaymentDialog({
  entityId,
  invoice,
  accounts,
  onClose,
  onRecorded,
}: {
  entityId: string;
  invoice: Invoice;
  accounts: Account[];
  onClose: () => void;
  onRecorded: () => void;
}) {
  const paidSoFar = invoice.invoice_payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, invoice.total - paidSoFar);

  const [amount, setAmount] = useState(String(remaining));
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moneyAccounts = accounts.filter((a) => MONEY_SUBTYPES.includes(a.account_subtype));
  const incomeAccounts = accounts.filter((a) => a.account_type === "income");

  async function handleSave() {
    if (!moneyAccountId || !incomeAccountId || !Number(amount)) {
      setError("Fill in the amount and both accounts");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await recordInvoicePayment({
      invoiceId: invoice.id,
      entityId,
      amount: Number(amount),
      paidDate,
      moneyAccountId,
      incomeAccountId,
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
          <DialogTitle>Record payment — {invoice.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Amount</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Date received</label>
          <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Deposited to</label>
          <select value={moneyAccountId} onChange={(e) => setMoneyAccountId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="">Choose...</option>
            {moneyAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Income category</label>
          <select value={incomeAccountId} onChange={(e) => setIncomeAccountId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="">Choose...</option>
            {incomeAccounts.map((a) => (
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
