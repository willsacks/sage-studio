"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { fetchBalanceSheet, fetchIncomeStatement, fetchProjectProfitability, fetchMonthlyIncomeExpense, fetchCashBalanceOverTime } from "@/lib/actions/finance-reports";
import { ExportCpaPackageButton } from "./ExportCpaPackageButton";
import type { FinanceEntity } from "./FinancesApp";

type Report = "pl" | "balance" | "projects" | "trends";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsTab({ entity }: { entity: FinanceEntity }) {
  const [report, setReport] = useState<Report>("pl");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          {([
            ["pl", "Income Statement"],
            ["balance", "Balance Sheet"],
            ["projects", "Project Comparison"],
            ["trends", "Trends"],
          ] as [Report, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setReport(id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${report === id ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ExportCpaPackageButton entityId={entity.id} />
      </div>

      {report === "pl" && <IncomeStatementReport entity={entity} />}
      {report === "balance" && <BalanceSheetReport entity={entity} />}
      {report === "projects" && <ProjectComparisonReport entity={entity} />}
      {report === "trends" && <TrendsReport entity={entity} />}
    </div>
  );
}

function TrendsReport({ entity }: { entity: FinanceEntity }) {
  const [incomeExpense, setIncomeExpense] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [cashBalance, setCashBalance] = useState<{ month: string; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMonthlyIncomeExpense(entity.id, 6), fetchCashBalanceOverTime(entity.id, 6)]).then(([ie, cb]) => {
      setIncomeExpense(ie.data ?? []);
      setCashBalance(cb.data ?? []);
      setLoading(false);
    });
  }, [entity.id]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">Income vs. Expenses</p>
        <div className="h-64 rounded-xl border border-[var(--border)] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeExpense}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(Number(v))} width={80} />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">Cash Balance</p>
        <div className="h-64 rounded-xl border border-[var(--border)] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashBalance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(Number(v))} width={80} />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Line type="monotone" dataKey="balance" name="Cash" stroke="var(--primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function IncomeStatementReport({ entity }: { entity: FinanceEntity }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchIncomeStatement>>["report"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncomeStatement(entity.id, startOfYear(), today()).then((r) => {
      setData(r.report ?? null);
      setLoading(false);
    });
  }, [entity.id]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  if (!data) return <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">Year to date ({startOfYear()} – {today()})</p>
      <ReportSection title="Income" sections={data.income} total={data.totalIncome} />
      <ReportSection title="Expenses" sections={data.expenses} total={data.totalExpenses} />
      <div className="flex justify-between pt-2 border-t border-[var(--border)] font-semibold text-sm">
        <span>Net Income</span>
        <span className={data.netIncome >= 0 ? "text-green-600" : "text-red-500"}>{money(data.netIncome)}</span>
      </div>
    </div>
  );
}

function BalanceSheetReport({ entity }: { entity: FinanceEntity }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBalanceSheet>>["report"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalanceSheet(entity.id, today()).then((r) => {
      setData(r.report ?? null);
      setLoading(false);
    });
  }, [entity.id]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  if (!data) return <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">As of {today()}</p>
      <ReportSection title="Assets" sections={data.assets} total={data.totalAssets} />
      <ReportSection title="Liabilities" sections={data.liabilities} total={data.totalLiabilities} />
      <ReportSection title="Equity" sections={data.equity} total={data.totalEquity} />
    </div>
  );
}

function ReportSection({ title, sections, total }: { title: string; sections: { subtype: string; accounts: { name: string; balance: number }[]; total: number }[]; total: number }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">{title}</p>
      <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {sections.length === 0 && <p className="px-4 py-3 text-sm text-[var(--muted-foreground)]">Nothing yet</p>}
        {sections.map((sec) => (
          <div key={sec.subtype} className="px-4 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">{sec.subtype}</p>
            {sec.accounts.map((a) => (
              <div key={a.name} className="flex justify-between text-sm py-0.5">
                <span>{a.name}</span>
                <span>{money(a.balance)}</span>
              </div>
            ))}
            {sec.accounts.length > 1 && (
              <div className="flex justify-between text-sm font-medium pt-0.5 border-t border-[var(--border)] mt-1">
                <span>Subtotal</span>
                <span>{money(sec.total)}</span>
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-between px-4 py-2 font-semibold text-sm">
          <span>Total {title}</span>
          <span>{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectComparisonReport({ entity }: { entity: FinanceEntity }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchProjectProfitability>>["projects"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjectProfitability(entity.id).then((r) => {
      setData(r.projects ?? []);
      setLoading(false);
    });
  }, [entity.id]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;

  const chartData = data.filter((p) => p.revenue > 0 || p.expenses > 0);
  if (chartData.length === 0) return <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">Tag transactions to a project to see this comparison.</p>;

  return (
    <div className="h-80 rounded-xl border border-[var(--border)] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v)} width={80} />
          <Tooltip formatter={(v) => money(Number(v))} />
          <Bar dataKey="netProfit" name="Net Profit" radius={[4, 4, 0, 0]}>
            {chartData.map((p, i) => (
              <Cell key={i} fill={p.netProfit >= 0 ? "#16a34a" : "#ef4444"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
