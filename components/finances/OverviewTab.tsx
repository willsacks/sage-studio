"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchBalanceSheet, fetchIncomeStatement, fetchProjectProfitability, fetchMonthlyIncomeExpense } from "@/lib/actions/finance-reports";
import { TaxSetAsideCard } from "./TaxSetAsideCard";
import type { FinanceEntity } from "./FinancesApp";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
/** "YYYY-MM" -> [first day, last day] — last day capped at today() when the
 * selected month is the current one, so a mid-August summary doesn't imply
 * data through August 31st. */
function monthRange(monthValue: string): [string, string] {
  const [y, m] = monthValue.split("-").map(Number);
  const start = `${monthValue}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const end = monthValue === currentMonthValue() ? today() : lastDay;
  return [start, end];
}
function monthLabel(monthValue: string) {
  const [y, m] = monthValue.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

export function OverviewTab({ entity }: { entity: FinanceEntity }) {
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [topProject, setTopProject] = useState<{ name: string; netProfit: number } | null>(null);

  const [trendMonths, setTrendMonths] = useState(12);
  const [trendData, setTrendData] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const [start, end] = monthRange(selectedMonth);
    Promise.all([
      fetchBalanceSheet(entity.id, today()),
      fetchIncomeStatement(entity.id, start, end),
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
  }, [entity.id, selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    setTrendLoading(true);
    fetchMonthlyIncomeExpense(entity.id, trendMonths).then((r) => {
      if (cancelled) return;
      setTrendData(r.data ?? []);
      setTrendLoading(false);
    });
    return () => { cancelled = true; };
  }, [entity.id, trendMonths]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;

  const net = monthIncome - monthExpenses;
  const isCurrentMonth = selectedMonth === currentMonthValue();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
          {isCurrentMonth ? "This month" : monthLabel(selectedMonth)}
        </p>
        <input
          type="month"
          value={selectedMonth}
          max={currentMonthValue()}
          onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Cash on hand" value={money(cash)} />
        <StatCard label={`${isCurrentMonth ? "This month's" : "Income"}`} value={money(monthIncome)} tone="positive" />
        <StatCard label={`${isCurrentMonth ? "This month's" : "Expenses"}`} value={money(monthExpenses)} tone="negative" />
        <StatCard label={`${isCurrentMonth ? "This month's" : "Net"}`} value={money(net)} tone={net >= 0 ? "positive" : "negative"} />
        {topProject && (
          <div className="col-span-2 md:col-span-4 rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Most profitable project</p>
            <p className="text-lg font-semibold mt-1">{topProject.name} — {money(topProject.netProfit)}</p>
          </div>
        )}
        {entity.entity_type === "business" && <TaxSetAsideCard entityId={entity.id} />}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Income vs. Expenses</p>
          <select
            value={trendMonths}
            onChange={(e) => setTrendMonths(Number(e.target.value))}
            className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>
        <div className="h-64 rounded-xl border border-[var(--border)] p-4">
          {trendLoading ? (
            <div className="flex justify-center items-center h-full"><Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(Number(v))} width={80} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
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
