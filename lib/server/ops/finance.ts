import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";
import { Page, Limit } from "@/lib/server/contract/common";
import { computeBalanceSheet, computeIncomeStatement, computeTrialBalance, type AccountRow, type LineRow } from "@/lib/finance/reports";

const entitySummary = z.object({
  id: z.string(),
  name: z.string(),
  entity_type: z.enum(["personal", "business"]),
  currency: z.string(),
  role: z.enum(["owner", "manager", "editor", "viewer"]),
});

export const financeListEntities = defineOperation({
  id: "finance.listEntities",
  tool: "finance_list_entities",
  module: "finance",
  minScope: "read",
  http: { method: "GET", path: "/finance/entities" },
  title: "List finance entities",
  description: "List the finance entities (books) the user owns or collaborates on, with their role on each.",
  input: z.object({}),
  output: Page(entitySummary),
  handler: async (ctx) => {
    const { rows } = await ctx.db.query(
      `select e.id, e.name, e.entity_type, e.currency,
              case when e.owner_id = $1 then 'owner' else m.role end as role
       from public.finance_entities e
       left join public.finance_entity_members m on m.entity_id = e.id and m.user_id = $1 and m.status = 'accepted'
       where e.owner_id = $1 or m.user_id = $1
       order by e.name asc`,
      [ctx.principal.userId]
    );
    return { items: rows, next_cursor: null };
  },
});

/** Confirms the entity exists and the user can see it (RLS already
 * backs this — a non-member/non-owner gets zero rows here), returning
 * not_found rather than an empty result so a stray/foreign id doesn't
 * silently look like "entity has no accounts/transactions". */
async function requireEntityVisible(db: Parameters<typeof financeListEntities.handler>[0]["db"], entityId: string): Promise<void> {
  const { rows } = await db.query(`select 1 from public.finance_entities where id = $1`, [entityId]);
  if (rows.length === 0) throw new Error("not_found");
}

const accountSummary = z.object({
  id: z.string(),
  name: z.string(),
  account_type: z.enum(["asset", "liability", "equity", "income", "expense"]),
  account_subtype: z.string(),
  is_active: z.boolean(),
});

export const financeListAccounts = defineOperation({
  id: "finance.listAccounts",
  tool: "finance_list_accounts",
  module: "finance",
  minScope: "read",
  http: { method: "GET", path: "/finance/entities/:entityId/accounts" },
  title: "List an entity's chart of accounts",
  description: "List the chart-of-accounts entries for one finance entity.",
  input: z.object({ entityId: z.string() }),
  output: Page(accountSummary),
  handler: async (ctx, input) => {
    await requireEntityVisible(ctx.db, input.entityId);
    const { rows } = await ctx.db.query(
      `select id, name, account_type, account_subtype, is_active from public.chart_of_accounts
       where entity_id = $1 order by display_order asc, name asc`,
      [input.entityId]
    );
    return { items: rows, next_cursor: null };
  },
});

const transactionSummary = z.object({
  id: z.string(),
  date: z.string(),
  payee_name: z.string(),
  // pg returns `numeric` columns as strings by default (lib/server/db/
  // pg-types.ts only overrides timestamp/date types) — coerce rather
  // than adding a NUMERIC parser globally, since other callers may rely
  // on getting a string back for exact decimal precision.
  amount: z.coerce.number(),
  status: z.enum(["uncategorized", "categorized", "excluded"]),
  needs_review: z.boolean(),
});

export const financeSearchTransactions = defineOperation({
  id: "finance.searchTransactions",
  tool: "finance_search_transactions",
  module: "finance",
  minScope: "read",
  http: { method: "GET", path: "/finance/entities/:entityId/transactions" },
  title: "Search an entity's transactions",
  description: "Search one finance entity's transactions by payee text, date range, and/or status. Filter status: \"uncategorized\" to find the review backlog (transactions that landed in Uncategorized Income/Expense because nothing matched them automatically) — pass each result's id to finance_categorize_transaction to fix it.",
  input: z.object({
    entityId: z.string(),
    text: z.string().max(200).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["uncategorized", "categorized", "excluded"]).optional(),
    limit: Limit,
  }),
  output: Page(transactionSummary),
  handler: async (ctx, input) => {
    await requireEntityVisible(ctx.db, input.entityId);
    const params: unknown[] = [input.entityId];
    let where = "entity_id = $1";
    if (input.text) {
      params.push(`%${input.text}%`);
      where += ` and payee_name ilike $${params.length}`;
    }
    if (input.startDate) {
      params.push(input.startDate);
      where += ` and date >= $${params.length}`;
    }
    if (input.endDate) {
      params.push(input.endDate);
      where += ` and date <= $${params.length}`;
    }
    if (input.status) {
      params.push(input.status);
      where += ` and status = $${params.length}`;
    }
    params.push(input.limit);
    const { rows } = await ctx.db.query(
      `select id, date, payee_name, amount, status, needs_review from public.transactions
       where ${where} order by date desc limit $${params.length}`,
      params
    );
    return { items: rows, next_cursor: null };
  },
});

async function fetchAccountsAndLines(
  db: Parameters<typeof financeListEntities.handler>[0]["db"],
  entityId: string,
  endDate: string,
  startDate?: string
): Promise<{ accounts: AccountRow[]; lines: LineRow[] }> {
  const { rows: accounts } = await db.query<AccountRow>(
    `select id, name, account_type, account_subtype from public.chart_of_accounts where entity_id = $1`,
    [entityId]
  );
  const params: unknown[] = [entityId, endDate];
  let where = "je.entity_id = $1 and je.entry_date <= $2";
  if (startDate) {
    params.push(startDate);
    where += ` and je.entry_date >= $${params.length}`;
  }
  const { rows: lineRows } = await db.query(
    `select jel.account_id, jel.debit, jel.credit, je.entity_id, je.entry_date
     from public.journal_entry_lines jel join public.journal_entries je on je.id = jel.journal_entry_id
     where ${where}`,
    params
  );
  const lines: LineRow[] = lineRows.map((r) => ({
    account_id: r.account_id,
    debit: Number(r.debit),
    credit: Number(r.credit),
    journal_entries: { entity_id: r.entity_id, entry_date: r.entry_date },
  }));
  return { accounts, lines };
}

const reportSection = z.object({
  subtype: z.string(),
  accounts: z.array(z.object({ accountId: z.string(), name: z.string(), subtype: z.string(), balance: z.number() })),
  total: z.number(),
});

export const financeGetReport = defineOperation({
  id: "finance.getReport",
  tool: "finance_get_report",
  module: "finance",
  minScope: "read",
  http: { method: "GET", path: "/finance/entities/:entityId/report" },
  title: "Get a P&L or balance sheet report",
  description: "Get an income statement (P&L, needs startDate+endDate) or balance sheet (needs asOfDate) for a finance entity. Reuses the exact same report logic the Sage Studio Finance UI itself uses.",
  input: z
    .object({
      entityId: z.string(),
      reportType: z.enum(["income_statement", "balance_sheet"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      asOfDate: z.string().optional(),
    })
    .refine((v) => (v.reportType === "income_statement" ? !!v.startDate && !!v.endDate : !!v.asOfDate), {
      message: "income_statement needs startDate and endDate; balance_sheet needs asOfDate.",
    }),
  output: z.union([
    z.object({
      reportType: z.literal("income_statement"),
      startDate: z.string(), endDate: z.string(),
      income: z.array(reportSection), expenses: z.array(reportSection),
      totalIncome: z.number(), totalExpenses: z.number(), netIncome: z.number(),
    }),
    z.object({
      reportType: z.literal("balance_sheet"),
      asOfDate: z.string(),
      assets: z.array(reportSection), liabilities: z.array(reportSection), equity: z.array(reportSection),
      totalAssets: z.number(), totalLiabilities: z.number(), totalEquity: z.number(), balanced: z.boolean(),
    }),
  ]),
  handler: async (ctx, input) => {
    await requireEntityVisible(ctx.db, input.entityId);
    if (input.reportType === "income_statement") {
      const { startDate, endDate } = input as { startDate: string; endDate: string };
      const { accounts, lines } = await fetchAccountsAndLines(ctx.db, input.entityId, endDate, startDate);
      const report = computeIncomeStatement(accounts, lines, startDate, endDate);
      return { reportType: "income_statement" as const, ...report };
    }
    const { asOfDate } = input as { asOfDate: string };
    const { accounts, lines } = await fetchAccountsAndLines(ctx.db, input.entityId, asOfDate);
    const report = computeBalanceSheet(accounts, lines, asOfDate);
    return { reportType: "balance_sheet" as const, ...report };
  },
});

export const financeGetCloseStatus = defineOperation({
  id: "finance.getCloseStatus",
  tool: "finance_get_close_status",
  module: "finance",
  minScope: "read",
  http: { method: "GET", path: "/finance/entities/:entityId/close-status" },
  title: "Get an entity's books-close status",
  description: "Check whether a finance entity's books are ready to close as of today: trial balance balanced, how many transactions are uncategorized or flagged for review, and the locked-through date.",
  input: z.object({ entityId: z.string() }),
  output: z.object({
    lockedThroughDate: z.string().nullable(),
    trialBalanceBalanced: z.boolean(),
    totalDebit: z.number(),
    totalCredit: z.number(),
    uncategorizedCount: z.number(),
    needsReviewCount: z.number(),
  }),
  handler: async (ctx, input) => {
    await requireEntityVisible(ctx.db, input.entityId);
    const asOfDate = new Date().toISOString().slice(0, 10);
    const [{ accounts, lines }, counts, entity] = await Promise.all([
      fetchAccountsAndLines(ctx.db, input.entityId, asOfDate),
      ctx.db.query(
        `select count(*) filter (where status = 'uncategorized') as uncategorized_count,
                count(*) filter (where needs_review) as needs_review_count
         from public.transactions where entity_id = $1`,
        [input.entityId]
      ),
      ctx.db.query(`select locked_through_date from public.finance_entities where id = $1`, [input.entityId]),
    ]);
    const trialBalance = computeTrialBalance(accounts, lines, asOfDate);
    return {
      lockedThroughDate: entity.rows[0]?.locked_through_date ?? null,
      trialBalanceBalanced: trialBalance.balanced,
      totalDebit: trialBalance.totalDebit,
      totalCredit: trialBalance.totalCredit,
      uncategorizedCount: Number(counts.rows[0]?.uncategorized_count ?? 0),
      needsReviewCount: Number(counts.rows[0]?.needs_review_count ?? 0),
    };
  },
});

export const financeOperations = [
  financeListEntities,
  financeListAccounts,
  financeSearchTransactions,
  financeGetReport,
  financeGetCloseStatus,
];
