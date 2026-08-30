"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { fetchBalanceSheet, fetchIncomeStatement, fetchProjectProfitability, fetchMonthlyIncomeExpense, fetchCashBalanceOverTime } from "@/lib/actions/finance-reports";
import { ExportCpaPackageButton } from "./ExportCpaPackageButton";
import { AccountTransactionsDialog } from "./AccountTransactionsDialog";
import type { FinanceEntity } from "./FinancesApp";

type Report = "pl" | "balance" | "projects" | "trends";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function startOfQuarter() {
  const d = new Date();
  const qMonth = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

type DateRange = { startDate: string; endDate: string };

const RANGE_PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "This month", range: () => ({ startDate: startOfMonth(), endDate: today() }) },
  { label: "This quarter", range: () => ({ startDate: startOfQuarter(), endDate: today() }) },
  { label: "This year", range: () => ({ startDate: startOfYear(), endDate: today() }) },
  { label: "All time", range: () => ({ startDate: "2000-01-01", endDate: today() }) },
];

/** Shared date-range control for the Income Statement, Balance Sheet
 * (which only uses the end date — a balance sheet is always "as of" a
 * single point in time, not a period), and Project Comparison. Trends has
 * its own "months back" control instead — a rolling window doesn't map
 * cleanly onto a start/end range picker. */
function DateRangePicker({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.range())}
            className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={range.startDate}
          onChange={(e) => onChange({ ...range, startDate: e.target.value })}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        />
        <span className="text-xs text-[var(--muted-foreground)]">to</span>
        <input
          type="date"
          value={range.endDate}
          onChange={(e) => onChange({ ...range, endDate: e.target.value })}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        />
      </div>
    </div>
  );
}

export function ReportsTab({ entity }: { entity: FinanceEntity }) {
  const [report, setReport] = useState<Report>("pl");
  const [range, setRange] = useState<DateRange>({ startDate: startOfYear(), endDate: today() });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
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

      {report !== "trends" && <DateRangePicker range={range} onChange={setRange} />}

      {report === "pl" && <IncomeStatementReport entity={entity} range={range} />}
      {report === "balance" && <BalanceSheetReport entity={entity} asOfDate={range.endDate} />}
      {report === "projects" && <ProjectComparisonReport entity={entity} range={range} />}
      {report === "trends" && <TrendsReport entity={entity} />}
    </div>
  );
}

function TrendsReport({ entity }: { entity: FinanceEntity }) {
  const [months, setMonths] = useState(12);
  const [incomeExpense, setIncomeExpense] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [cashBalance, setCashBalance] = useState<{ month: string; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMonthlyIncomeExpense(entity.id, months), fetchCashBalanceOverTime(entity.id, months)]).then(([ie, cb]) => {
      setIncomeExpense(ie.data ?? []);
      setCashBalance(cb.data ?? []);
      setLoading(false);
    });
  }, [entity.id, months]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted-foreground)]">Show last</span>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        >
          <option value={3}>3 months</option>
          <option value={6}>6 months</option>
          <option value={12}>12 months</option>
          <option value={24}>24 months</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function IncomeStatementReport({ entity, range }: { entity: FinanceEntity; range: DateRange }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchIncomeStatement>>["report"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [drilldown, setDrilldown] = useState<{ accountId: string; accountName: string } | null>(null);

  function refresh() {
    fetchIncomeStatement(entity.id, range.startDate, range.endDate).then((r) => {
      setData(r.report ?? null);
      setLoading(false);
    });
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id, range.startDate, range.endDate]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  if (!data) return <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">{range.startDate} – {range.endDate}</p>
      <ReportSection title="Income" sections={data.income} total={data.totalIncome} onAccountClick={(id, name) => setDrilldown({ accountId: id, accountName: name })} />
      <ReportSection title="Expenses" sections={data.expenses} total={data.totalExpenses} onAccountClick={(id, name) => setDrilldown({ accountId: id, accountName: name })} />
      <div className="flex justify-between pt-2 border-t border-[var(--border)] font-semibold text-sm">
        <span>Net Income</span>
        <span className={data.netIncome >= 0 ? "text-green-600" : "text-red-500"}>{money(data.netIncome)}</span>
      </div>

      {drilldown && (
        <AccountTransactionsDialog
          entityId={entity.id}
          accountId={drilldown.accountId}
          accountName={drilldown.accountName}
          startDate={range.startDate}
          endDate={range.endDate}
          onClose={() => setDrilldown(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function BalanceSheetReport({ entity, asOfDate }: { entity: FinanceEntity; asOfDate: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBalanceSheet>>["report"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBalanceSheet(entity.id, asOfDate).then((r) => {
      setData(r.report ?? null);
      setLoading(false);
    });
  }, [entity.id, asOfDate]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  if (!data) return <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">As of {asOfDate}</p>
      <ReportSection title="Assets" sections={data.assets} total={data.totalAssets} />
      <ReportSection title="Liabilities" sections={data.liabilities} total={data.totalLiabilities} />
      <ReportSection title="Equity" sections={data.equity} total={data.totalEquity} />
    </div>
  );
}

function ReportSection({
  title,
  sections,
  total,
  onAccountClick,
}: {
  title: string;
  sections: { subtype: string; accounts: { accountId: string; name: string; balance: number }[]; total: number }[];
  total: number;
  onAccountClick?: (accountId: string, accountName: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">{title}</p>
      <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {sections.length === 0 && <p className="px-4 py-3 text-sm text-[var(--muted-foreground)]">Nothing yet</p>}
        {sections.map((sec) => (
          <div key={sec.subtype} className="px-4 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">{sec.subtype}</p>
            {sec.accounts.map((a) =>
              onAccountClick ? (
                <button
                  key={a.name}
                  onClick={() => onAccountClick(a.accountId, a.name)}
                  className="flex justify-between w-full text-sm py-0.5 text-left hover:text-[var(--primary)] hover:underline"
                >
                  <span>{a.name}</span>
                  <span>{money(a.balance)}</span>
                </button>
              ) : (
                <div key={a.name} className="flex justify-between text-sm py-0.5">
                  <span>{a.name}</span>
                  <span>{money(a.balance)}</span>
                </div>
              )
            )}
            {sec.accounts.length !== 1 && (
              // Not just accounts.length > 1 — the balance sheet's synthetic
              // "Retained Earnings (YTD)" section has zero individual
              // accounts but a real nonzero total (current-year net income
              // rolled into equity), and with only the >1 check that total
              // never rendered anywhere: the label showed with no number
              // next to it, looking like a broken/empty section even though
              // Total Equity below correctly included it. A single-account
              // section still skips this, since it'd just repeat that one
              // account's own balance.
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

function ProjectComparisonReport({ entity, range }: { entity: FinanceEntity; range: DateRange }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchProjectProfitability>>["projects"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchProjectProfitability(entity.id, range.startDate, range.endDate).then((r) => {
      setData(r.projects ?? []);
      setLoading(false);
    });
  }, [entity.id, range.startDate, range.endDate]);

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
