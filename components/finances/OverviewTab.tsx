"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchBalanceSheet, fetchIncomeStatement, fetchProjectProfitability } from "@/lib/actions/finance-reports";
import { TaxSetAsideCard } from "./TaxSetAsideCard";
import type { FinanceEntity } from "./FinancesApp";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function OverviewTab({ entity }: { entity: FinanceEntity }) {
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [topProject, setTopProject] = useState<{ name: string; netProfit: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchBalanceSheet(entity.id, today()),
      fetchIncomeStatement(entity.id, startOfMonth(), today()),
      fetchProjectProfitability(entity.id),
    ]).then(([balance, income, projects]) => {
      if (cancelled) return;
      const cashTotal = (balance.report?.assets ?? [])
        .filter((s) => s.subtype === "Cash and Bank")
        .reduce((sum, s) => sum + s.total, 0);
      setCash(cashTotal);
      setMonthIncome(income.report?.totalIncome ?? 0);
      setMonthExpenses(income.report?.totalExpenses ?? 0);
      const best = [...(projects.projects ?? [])].sort((a, b) => b.netProfit - a.netProfit)[0];
      setTopProject(best && (best.revenue > 0 || best.expenses > 0) ? { name: best.name, netProfit: best.netProfit } : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entity.id]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;

  const net = monthIncome - monthExpenses;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Cash on hand" value={money(cash)} />
      <StatCard label="This month's income" value={money(monthIncome)} tone="positive" />
      <StatCard label="This month's expenses" value={money(monthExpenses)} tone="negative" />
      <StatCard label="This month's net" value={money(net)} tone={net >= 0 ? "positive" : "negative"} />
      {topProject && (
        <div className="col-span-2 md:col-span-4 rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Most profitable project</p>
          <p className="text-lg font-semibold mt-1">{topProject.name} — {money(topProject.netProfit)}</p>
        </div>
      )}
      {entity.entity_type === "business" && <TaxSetAsideCard entityId={entity.id} />}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${tone === "positive" ? "text-green-600" : tone === "negative" ? "text-red-500" : ""}`}>{value}</p>
    </div>
  );
}
