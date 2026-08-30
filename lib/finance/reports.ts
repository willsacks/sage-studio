import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";

type AccountRow = {
  id: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  account_subtype: string;
};

type LineRow = {
  account_id: string;
  debit: number;
  credit: number;
  journal_entries: { entity_id: string; entry_date: string } | { entity_id: string; entry_date: string }[];
};

function entryOf(row: LineRow) {
  return Array.isArray(row.journal_entries) ? row.journal_entries[0] : row.journal_entries;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLines(supabase: SupabaseClient<Database> | any, entityId: string, endDate: string, startDate?: string) {
  let query = supabase
    .from("journal_entry_lines")
    .select("account_id, debit, credit, journal_entries!inner(entity_id, entry_date)")
    .eq("journal_entries.entity_id", entityId)
    .lte("journal_entries.entry_date", endDate);
  if (startDate) query = query.gte("journal_entries.entry_date", startDate);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LineRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAccounts(supabase: SupabaseClient<Database> | any, entityId: string) {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, name, account_type, account_subtype")
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AccountRow[];
}

export type AccountBalance = { accountId: string; name: string; subtype: string; balance: number };
export type ReportSection = { subtype: string; accounts: AccountBalance[]; total: number };

function groupBySubtype(balances: AccountBalance[]): ReportSection[] {
  const bySubtype = new Map<string, AccountBalance[]>();
  for (const b of balances) {
    if (!bySubtype.has(b.subtype)) bySubtype.set(b.subtype, []);
    bySubtype.get(b.subtype)!.push(b);
  }
  return [...bySubtype.entries()].map(([subtype, accounts]) => ({
    subtype,
    accounts,
    total: accounts.reduce((sum, a) => sum + a.balance, 0),
  }));
}

/** Balance Sheet as of a given date: assets, liabilities, equity (current-year
 * net income rolls into equity as "Retained Earnings (YTD)" rather than
 * requiring a manual period-close entry). */
export async function getBalanceSheet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  asOfDate: string
) {
  const [accounts, lines] = await Promise.all([fetchAccounts(supabase, entityId), fetchLines(supabase, entityId, asOfDate)]);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const balanceByAccount = new Map<string, number>();
  for (const line of lines) {
    const account = accountsById.get(line.account_id);
    if (!account) continue;
    const net = account.account_type === "asset" || account.account_type === "expense"
      ? line.debit - line.credit
      : line.credit - line.debit;
    balanceByAccount.set(line.account_id, (balanceByAccount.get(line.account_id) ?? 0) + net);
  }

  const toBalances = (type: AccountRow["account_type"]): AccountBalance[] =>
    accounts
      .filter((a) => a.account_type === type)
      .map((a) => ({ accountId: a.id, name: a.name, subtype: a.account_subtype, balance: round2(balanceByAccount.get(a.id) ?? 0) }))
      .filter((b) => b.balance !== 0);

  const assets = groupBySubtype(toBalances("asset"));
  const liabilities = groupBySubtype(toBalances("liability"));
  const equity = groupBySubtype(toBalances("equity"));

  const totalAssets = round2(assets.reduce((s, sec) => s + sec.total, 0));
  const totalLiabilities = round2(liabilities.reduce((s, sec) => s + sec.total, 0));
  const totalEquityBeforeNetIncome = round2(equity.reduce((s, sec) => s + sec.total, 0));

  // Net income YTD (income − expense) plugs the balance sheet, matching
  // Wave's no-manual-close approach.
  const incomeBalances = toBalances("income");
  const expenseBalances = toBalances("expense");
  const netIncomeYtd = round2(
    incomeBalances.reduce((s, a) => s + a.balance, 0) - expenseBalances.reduce((s, a) => s + a.balance, 0)
  );

  const totalEquity = round2(totalEquityBeforeNetIncome + netIncomeYtd);

  return {
    asOfDate,
    assets,
    liabilities,
    equity: [...equity, { subtype: "Retained Earnings (YTD)", accounts: [], total: netIncomeYtd }],
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: round2(totalAssets - (totalLiabilities + totalEquity)) === 0,
  };
}

/** Income Statement / P&L over a date range. */
export async function getIncomeStatement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  startDate: string,
  endDate: string
) {
  const [accounts, lines] = await Promise.all([
    fetchAccounts(supabase, entityId),
    fetchLines(supabase, entityId, endDate, startDate),
  ]);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const balanceByAccount = new Map<string, number>();
  for (const line of lines) {
    const account = accountsById.get(line.account_id);
    if (!account || (account.account_type !== "income" && account.account_type !== "expense")) continue;
    const net = account.account_type === "expense" ? line.debit - line.credit : line.credit - line.debit;
    balanceByAccount.set(line.account_id, (balanceByAccount.get(line.account_id) ?? 0) + net);
  }

  const toBalances = (type: "income" | "expense"): AccountBalance[] =>
    accounts
      .filter((a) => a.account_type === type)
      .map((a) => ({ accountId: a.id, name: a.name, subtype: a.account_subtype, balance: round2(balanceByAccount.get(a.id) ?? 0) }))
      .filter((b) => b.balance !== 0);

  const income = groupBySubtype(toBalances("income"));
  const expenses = groupBySubtype(toBalances("expense"));
  const totalIncome = round2(income.reduce((s, sec) => s + sec.total, 0));
  const totalExpenses = round2(expenses.reduce((s, sec) => s + sec.total, 0));

  return { startDate, endDate, income, expenses, totalIncome, totalExpenses, netIncome: round2(totalIncome - totalExpenses) };
}

/** Project profitability — the headline report. Aggregates revenue/expense
 * attributed to each project via transaction_splits.project_id, independent
 * of the ledger's account grouping (a project can pull from many accounts). */
export async function getProjectProfitability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  startDate?: string,
  endDate?: string
) {
  const { data: projects, error: projectsError } = await supabase
    .from("finance_projects")
    .select("id, name, project_type, status")
    .eq("entity_id", entityId);
  if (projectsError) throw new Error(projectsError.message);

  let query = supabase
    .from("transaction_splits")
    .select("project_id, amount, chart_of_accounts!inner(account_type), transactions!inner(entity_id, date, status)")
    .eq("transactions.entity_id", entityId)
    .neq("transactions.status", "excluded")
    .not("project_id", "is", null);
  if (startDate) query = query.gte("transactions.date", startDate);
  if (endDate) query = query.lte("transactions.date", endDate);
  const { data: splits, error: splitsError } = await query;
  if (splitsError) throw new Error(splitsError.message);

  const byProject = new Map<string, { revenue: number; expenses: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (splits ?? []) as any[]) {
    const accountType = Array.isArray(s.chart_of_accounts) ? s.chart_of_accounts[0]?.account_type : s.chart_of_accounts?.account_type;
    if (!s.project_id) continue;
    const entry = byProject.get(s.project_id) ?? { revenue: 0, expenses: 0 };
    if (accountType === "income") entry.revenue += Math.abs(s.amount);
    else if (accountType === "expense") entry.expenses += Math.abs(s.amount);
    byProject.set(s.project_id, entry);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (projects as any[]).map((p) => {
    const totals = byProject.get(p.id) ?? { revenue: 0, expenses: 0 };
    const revenue = round2(totals.revenue);
    const expenses = round2(totals.expenses);
    const netProfit = round2(revenue - expenses);
    return {
      projectId: p.id as string,
      name: p.name as string,
      projectType: p.project_type as string | null,
      status: p.status as string,
      revenue,
      expenses,
      netProfit,
      margin: revenue > 0 ? round2((netProfit / revenue) * 100) : null,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Income vs. expense per calendar month over a date range — feeds the
 * Reports tab's trend chart. Computed by re-running the income-statement
 * aggregation once per month bucket; fine at this data volume (a handful
 * of months of a single creator's books), not worth a SQL date_trunc
 * query until it becomes a real perf problem. */
export async function getMonthlyIncomeExpense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  months: number
) {
  const now = new Date();
  const results: { month: string; income: number; expenses: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const start = bucket.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(bucket.getUTCFullYear(), bucket.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const statement = await getIncomeStatement(supabase, entityId, start, end);
    results.push({
      // The bucket is built from UTC components at midnight — formatting
      // with the default (local) timezone rolls day 1 back across the month
      // boundary for any timezone behind UTC (e.g. America/Chicago),
      // mislabeling every bar one month early. Force UTC so the label
      // matches the month whose data was actually queried.
      month: bucket.toLocaleString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }),
      income: statement.totalIncome,
      expenses: statement.totalExpenses,
    });
  }
  return results;
}

/** Cash balance (all "Cash and Bank" subtype accounts, summed) at the end
 * of each of the last N months — for the cash-over-time chart. */
export async function getCashBalanceOverTime(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  months: number
) {
  const now = new Date();
  const results: { month: string; balance: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0));
    const asOf = bucket.toISOString().slice(0, 10);
    const balanceSheet = await getBalanceSheet(supabase, entityId, asOf);
    const cash = balanceSheet.assets.filter((s) => s.subtype === "Cash and Bank").reduce((sum, s) => sum + s.total, 0);
    // Forced to UTC for the same reason as getMonthlyIncomeExpense above —
    // this bucket (last day of month at UTC midnight) happens not to cross
    // a month boundary when shifted to a behind-UTC local timezone, but
    // that's incidental to which day-of-month it lands on, not a real
    // guarantee, so it's forced explicit here too rather than left fragile.
    results.push({ month: bucket.toLocaleString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }), balance: round2(cash) });
  }
  return results;
}
