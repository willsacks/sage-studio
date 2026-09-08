"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, ChevronDown } from "lucide-react";
import { createInvoiceFromTimeEntries } from "@/lib/actions/finance-invoices";
import { listFinanceEntities } from "@/lib/actions/finance-entities";
import { format } from "date-fns";

interface FinanceEntity { id: string; name: string }

interface CreateInvoicePanelProps {
  clientId: string;
  clientName: string;
  defaultRate?: number | null;
  from?: string;
  to?: string;
  unbilledSecs: number;
}

function formatHours(secs: number) {
  const h = secs / 3600;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(2)}h`;
}

export function CreateInvoiceButton({ clientId, clientName, defaultRate, from, to, unbilledSecs }: CreateInvoicePanelProps) {
  const [open, setOpen] = useState(false);

  if (unbilledSecs === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-xl hover:opacity-90 transition-opacity print-hidden"
      >
        <FileText size={14} />
        Create Invoice
      </button>

      {open && (
        <CreateInvoiceModal
          clientId={clientId}
          clientName={clientName}
          defaultRate={defaultRate}
          from={from}
          to={to}
          unbilledSecs={unbilledSecs}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CreateInvoiceModal({ clientId, clientName, defaultRate, from, to, unbilledSecs, onClose }: CreateInvoicePanelProps & { onClose: () => void }) {
  const router = useRouter();
  const [entities, setEntities] = useState<FinanceEntity[] | null>(null);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [entityId, setEntityId] = useState<string>("");
  const [rate, setRate] = useState(defaultRate ? String(defaultRate) : "");
  const [email, setEmail] = useState("");
  const [lineStyle, setLineStyle] = useState<"summary" | "by_day">("summary");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return format(d, "yyyy-MM-dd");
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Load entities on mount
  useEffect(() => {
    listFinanceEntities().then((res) => {
      const list = (res.entities ?? []) as FinanceEntity[];
      setEntities(list);
      if (list.length === 1) setEntityId(list[0].id);
      setLoadingEntities(false);
    });
  }, []);

  const rateNum = parseFloat(rate);
  const totalHrs = unbilledSecs / 3600;
  const totalAmount = !isNaN(rateNum) && rateNum > 0 ? (totalHrs * rateNum).toFixed(2) : null;

  function handleSubmit() {
    if (!entityId) { setError("Select a finance entity"); return; }
    if (!rateNum || rateNum <= 0) { setError("Enter a valid hourly rate"); return; }
    setError(null);
    startTransition(async () => {
      try {
        const result = await createInvoiceFromTimeEntries({
          clientId,
          clientName,
          clientEmail: email.trim() || undefined,
          entityId,
          hourlyRate: rateNum,
          issueDate,
          dueDate: dueDate || undefined,
          lineStyle,
          from,
          to,
        });
        if (result?.error) {
          setError(result.error);
        } else {
          router.push("/finances");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const inputCls = "w-full bg-[var(--accent)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]";
  const labelCls = "block text-xs font-medium text-[var(--muted-foreground)] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Create Invoice</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {clientName} · {formatHours(unbilledSecs)} unbilled
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--muted-foreground)]">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Finance entity */}
          {loadingEntities ? (
            <div className="h-9 rounded-lg bg-[var(--accent)] animate-pulse" />
          ) : entities && entities.length > 1 ? (
            <div>
              <label className={labelCls}>Bill from</label>
              <div className="relative">
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className={`${inputCls} appearance-none pr-8`}
                >
                  <option value="">Select entity…</option>
                  {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
              </div>
            </div>
          ) : entities && entities.length === 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted-foreground)] text-xs">Billing from</span>
              <span className="font-medium text-[var(--foreground)] text-xs">{entities[0].name}</span>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              No finance entities found.{" "}
              <a href="/finances" className="underline">Set one up in Finance</a> first.
            </p>
          )}

          {/* Hourly rate + total preview */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hourly rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="150"
                  className={`${inputCls} pl-6`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Total</label>
              <div className="h-9 flex items-center px-3 bg-[var(--accent)] rounded-lg text-sm font-mono font-semibold text-[var(--foreground)]">
                {totalAmount ? `$${parseFloat(totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
              </div>
            </div>
          </div>

          {/* Client email */}
          <div>
            <label className={labelCls}>Client email <span className="font-normal opacity-60">(optional)</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className={inputCls}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Issue date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Line item style */}
          <div>
            <label className={labelCls}>Line items</label>
            <div className="flex gap-2">
              {(["summary", "by_day"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLineStyle(s)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    lineStyle === s
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {s === "summary" ? "One summary line" : "Grouped by day"}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-4 py-2 rounded-xl hover:bg-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !entityId || !rateNum || rateNum <= 0}
            className="flex items-center gap-1.5 text-sm font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <FileText size={13} />
            {pending ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
