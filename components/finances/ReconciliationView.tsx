"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listReconciliations,
  startReconciliation,
  getReconciliationCandidates,
  setTransactionCleared,
  finishReconciliation,
  reopenReconciliation,
} from "@/lib/actions/finance-reconciliation";

type Reconciliation = {
  id: string;
  statement_start_date: string;
  statement_end_date: string;
  statement_ending_balance: number;
  beginning_balance: number;
  status: "in_progress" | "completed";
};
type CandidateTxn = { id: string; date: string; payee_name: string; amount: number; cleared_at: string | null };

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function ReconciliationView({
  entityId,
  bankAccountId,
  accountName,
  onClose,
}: {
  entityId: string;
  bankAccountId: string;
  accountName: string;
  onClose: () => void;
}) {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateTxn[]>([]);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endingBalance, setEndingBalance] = useState("");
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const refreshList = useCallback(async () => {
    setLoading(true);
    const result = await listReconciliations(bankAccountId, entityId);
    const list = (result.reconciliations ?? []) as Reconciliation[];
    setReconciliations(list);
    const inProgress = list.find((r) => r.status === "in_progress");
    setActiveId(inProgress?.id ?? null);
    setLoading(false);
  }, [bankAccountId, entityId]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const loadCandidates = useCallback(async () => {
    if (!activeId) return;
    const result = await getReconciliationCandidates(activeId, entityId);
    if (result.error) {
      setError(result.error);
      return;
    }
    const txns = (result.transactions ?? []) as CandidateTxn[];
    setCandidates(txns);
    setCleared(new Set(txns.filter((t) => t.cleared_at).map((t) => t.id)));
  }, [activeId, entityId]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const activeReconciliation = reconciliations.find((r) => r.id === activeId);

  async function handleStart() {
    if (!endingBalance) {
      setError("Enter the statement ending balance");
      return;
    }
    setStarting(true);
    setError(null);
    const result = await startReconciliation({
      entityId,
      bankAccountId,
      statementStartDate: startDate,
      statementEndDate: endDate,
      statementEndingBalance: Number(endingBalance),
    });
    setStarting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setActiveId(result.reconciliationId!);
    refreshList();
  }

  async function toggle(txnId: string, next: boolean) {
    if (!activeId) return;
    setCleared((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(txnId);
      else copy.delete(txnId);
      return copy;
    });
    await setTransactionCleared(txnId, activeId, entityId, next);
  }

  async function handleFinish() {
    if (!activeId) return;
    setFinishing(true);
    setError(null);
    const result = await finishReconciliation(activeId, entityId);
    setFinishing(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    refreshList();
  }

  async function handleReopen(reconciliationId: string) {
    const result = await reopenReconciliation(reconciliationId, entityId);
    if (result.error) {
      setError(result.error);
      return;
    }
    refreshList();
  }

  const clearedTotal = candidates.filter((t) => cleared.has(t.id)).reduce((sum, t) => sum + t.amount, 0);
  const difference = activeReconciliation
    ? Math.round((activeReconciliation.statement_ending_balance - (activeReconciliation.beginning_balance + clearedTotal)) * 100) / 100
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
        <DialogHeader>
          <DialogTitle>Reconcile — {accountName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
        ) : !activeId ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Statement start</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Statement end</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Ending balance</label>
                <Input type="number" value={endingBalance} onChange={(e) => setEndingBalance(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button size="sm" onClick={handleStart} disabled={starting}>
              {starting && <Loader2 size={13} className="animate-spin mr-1" />} Start reconciling
            </Button>

            {reconciliations.length > 0 && (
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">History</p>
                <div className="space-y-1">
                  {reconciliations.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm py-1">
                      <span>{r.statement_start_date} – {r.statement_end_date} · {money(r.statement_ending_balance)}</span>
                      {r.status === "completed" && r.id === reconciliations[0].id && (
                        <button onClick={() => handleReopen(r.id)} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Reopen</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] max-h-80 overflow-y-auto">
              {candidates.map((t) => (
                <label key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={cleared.has(t.id)} onChange={(e) => toggle(t.id, e.target.checked)} />
                  <span className="flex-1">{t.date} — {t.payee_name}</span>
                  <span className={t.amount >= 0 ? "text-green-600" : "text-red-500"}>{money(t.amount)}</span>
                </label>
              ))}
              {candidates.length === 0 && <p className="px-3 py-4 text-sm text-[var(--muted-foreground)]">No transactions to clear.</p>}
            </div>

            <div className="rounded-lg bg-[var(--muted)]/30 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Statement ending balance</span><span>{money(activeReconciliation!.statement_ending_balance)}</span></div>
              <div className="flex justify-between"><span>Beginning balance</span><span>{money(activeReconciliation!.beginning_balance)}</span></div>
              <div className="flex justify-between"><span>Cleared transactions</span><span>{money(clearedTotal)}</span></div>
              <div className="flex justify-between font-semibold pt-1 border-t border-[var(--border)]">
                <span>Difference</span>
                <span className={difference === 0 ? "text-green-600" : "text-amber-600"}>{money(difference ?? 0)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button size="sm" onClick={handleFinish} disabled={finishing || difference !== 0}>
              {finishing ? <Loader2 size={13} className="animate-spin mr-1" /> : <Check size={13} className="mr-1" />}
              Finish reconciling
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
