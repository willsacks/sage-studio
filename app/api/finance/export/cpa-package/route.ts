import { PassThrough } from "stream";
import { createRequire } from "module";
import { NextRequest, NextResponse } from "next/server";

// @types/archiver doesn't declare the package's actual callable default
// export (`archiver('zip', opts)`) — only its named classes — so import via
// require() instead of fighting the mismatched type declarations.
const archiver = createRequire(import.meta.url)("archiver") as (format: "zip", options?: { zlib?: { level: number } }) => import("archiver").Archiver;
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { getBalanceSheet, getIncomeStatement, getProjectProfitability, getTrialBalance, getJournalRegister } from "@/lib/finance/reports";

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

// A Route Handler rather than a Server Action — the response is a binary
// ZIP stream, not JSON, and can be a few hundred KB+ for a year of
// transactions, well past what Server Actions are meant to return.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const entityId = request.nextUrl.searchParams.get("entityId");
  const year = request.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear());
  if (!entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 });

  try {
    await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const [balanceSheet, incomeStatement, profitability, trialBalance, journalRegister, accountsResult, transactionsResult] = await Promise.all([
    getBalanceSheet(supabase, entityId, endDate),
    getIncomeStatement(supabase, entityId, startDate, endDate),
    getProjectProfitability(supabase, entityId, startDate, endDate),
    getTrialBalance(supabase, entityId, endDate),
    getJournalRegister(supabase, entityId, startDate, endDate),
    supabase.from("chart_of_accounts").select("name, account_type, account_subtype, is_active").eq("entity_id", entityId),
    supabase
      .from("transactions")
      .select("date, payee_name, amount, status, transaction_splits(amount, chart_of_accounts(name), finance_projects(name))")
      .eq("entity_id", entityId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),
  ]);

  const coaCsv = toCsv([
    ["Name", "Type", "Subtype", "Active"],
    ...(accountsResult.data ?? []).map((a) => [a.name, a.account_type, a.account_subtype, a.is_active ? "Yes" : "No"]),
  ]);

  const plCsv = toCsv([
    ["Section", "Category", "Account", "Amount"],
    ...incomeStatement.income.flatMap((sec) => sec.accounts.map((a) => ["Income", sec.subtype, a.name, a.balance])),
    ...incomeStatement.expenses.flatMap((sec) => sec.accounts.map((a) => ["Expense", sec.subtype, a.name, a.balance])),
    ["", "", "Total Income", incomeStatement.totalIncome],
    ["", "", "Total Expenses", incomeStatement.totalExpenses],
    ["", "", "Net Income", incomeStatement.netIncome],
  ]);

  const bsCsv = toCsv([
    ["Section", "Category", "Account", "Balance"],
    ...balanceSheet.assets.flatMap((sec) => sec.accounts.map((a) => ["Asset", sec.subtype, a.name, a.balance])),
    ...balanceSheet.liabilities.flatMap((sec) => sec.accounts.map((a) => ["Liability", sec.subtype, a.name, a.balance])),
    ...balanceSheet.equity.flatMap((sec) => sec.accounts.map((a) => ["Equity", sec.subtype, a.name, a.balance])),
    ["", "", "Total Assets", balanceSheet.totalAssets],
    ["", "", "Total Liabilities", balanceSheet.totalLiabilities],
    ["", "", "Total Equity", balanceSheet.totalEquity],
  ]);

  const projectsCsv = toCsv([
    ["Project", "Type", "Status", "Revenue", "Expenses", "Net Profit", "Margin %"],
    ...profitability.map((p) => [p.name, p.projectType ?? "", p.status, p.revenue, p.expenses, p.netProfit, p.margin ?? ""]),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactionRows = ((transactionsResult.data ?? []) as any[]).map((t) => {
    const splits = t.transaction_splits as { amount: number; chart_of_accounts: { name: string } | null; finance_projects: { name: string } | null }[];
    const categories = splits.map((s) => s.chart_of_accounts?.name).filter(Boolean).join("; ");
    const projects = splits.map((s) => s.finance_projects?.name).filter(Boolean).join("; ");
    return [t.date, t.payee_name, t.amount, t.status, categories, projects];
  });
  const transactionsCsv = toCsv([["Date", "Payee", "Amount", "Status", "Categories", "Projects"], ...transactionRows]);

  const trialBalanceCsv = toCsv([
    ["Account", "Type", "Debit", "Credit"],
    ...trialBalance.rows.map((r) => [r.name, r.accountType, r.debit, r.credit]),
    ["", "Total", trialBalance.totalDebit, trialBalance.totalCredit],
  ]);

  const journalRegisterCsv = toCsv([
    ["Date", "Entry ID", "Source", "Description", "Account", "Debit", "Credit", "Memo"],
    ...journalRegister.map((r) => [r.date, r.entryId, r.sourceType, r.description ?? "", r.accountName, r.debit, r.credit, r.memo ?? ""]),
  ]);

  const archive = archiver("zip", { zlib: { level: 9 } });
  const passThrough = new PassThrough();
  const chunks: Buffer[] = [];
  passThrough.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });
  archive.pipe(passThrough);

  archive.append(coaCsv, { name: "chart-of-accounts.csv" });
  archive.append(plCsv, { name: "income-statement.csv" });
  archive.append(bsCsv, { name: "balance-sheet.csv" });
  archive.append(trialBalanceCsv, { name: "trial-balance.csv" });
  archive.append(journalRegisterCsv, { name: "journal-register.csv" });
  archive.append(projectsCsv, { name: "project-profitability.csv" });
  archive.append(transactionsCsv, { name: "transactions.csv" });
  await archive.finalize();

  const buffer = await done;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="cpa-package-${year}.zip"`,
    },
  });
}
