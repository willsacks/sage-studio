import { z } from "zod";
import type { PoolClient } from "pg";
import { defineOperation, OpValidationError } from "@/lib/server/contract/operation";
import { PgSupabaseShim } from "@/lib/server/db/supabase-shim";
import {
  commitCreateEntity,
  commitAccounts,
  commitCustomers,
  commitInvoiceBatch,
  commitPayment,
  findAccountIdByExternalId,
  findCustomerIdByExternalId,
  type StagedAccount,
  type StagedCustomer,
  type StagedInvoice,
  type StagedPayment,
} from "@/lib/finance/import-commit";
import { postImportedTransaction, postJournalEntry } from "@/lib/finance/ledger";
import { normalBalanceForType } from "@/lib/finance/default-accounts";

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, manager: 2, owner: 3 };

/** Mirrors lib/access/finance-access.ts's requireFinanceEntityRole — see
 * lib/server/ops/sites-write.ts's identical rationale: RLS on these
 * tables gates "is a collaborator at all", not the role threshold a
 * write actually needs, so this check is load-bearing. */
async function requireEditorRole(db: PoolClient, entityId: string, userId: string): Promise<void> {
  const { rows } = await db.query(
    `select case when e.owner_id = $2 then 'owner' else m.role end as role
     from public.finance_entities e
     left join public.finance_entity_members m on m.entity_id = e.id and m.user_id = $2 and m.status = 'accepted'
     where e.id = $1 and (e.owner_id = $2 or m.user_id = $2)`,
    [entityId, userId]
  );
  const role = rows[0]?.role as string | undefined;
  if (!role || (ROLE_RANK[role] ?? -1) < ROLE_RANK.editor) throw new Error("not_found");
}

const stagedAccount = z.object({
  name: z.string().min(1),
  accountType: z.enum(["asset", "liability", "equity", "income", "expense"]),
  accountSubtype: z.string().min(1),
  externalId: z.string().optional(),
  parentExternalId: z.string().optional(),
  /** Posts a journal entry dated asOfDate crediting/debiting this account
   * against "Opening Balance Equity" (seeded on every entity) — same
   * convention a bookkeeper uses to bring a new set of books in sync
   * with a prior system as of a cutover date. */
  openingBalance: z.object({ amount: z.number(), asOfDate: z.string() }).optional(),
});

const stagedCustomer = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  externalId: z.string().optional(),
});

const stagedInvoiceLineItem = z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number() });
const stagedInvoice = z.object({
  externalId: z.string(),
  invoiceNumber: z.string().optional(),
  customerExternalId: z.string().optional(),
  issueDate: z.string(),
  dueDate: z.string().optional(),
  lineItems: z.array(stagedInvoiceLineItem).min(1),
  taxAmount: z.number().optional(),
  totalOverride: z.number().optional(),
});

export const financeCreateEntity = defineOperation({
  id: "finance.createEntity",
  tool: "finance_create_entity",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities" },
  title: "Create a finance entity to import into",
  description: "Creates a brand-new finance entity (books) for an import to target. Only needed when there isn't already an entity to import into — if one exists, call finance_list_entities and pass its id directly to the import tools below instead of creating a new one.",
  input: z.object({ name: z.string().min(1).max(200), entityType: z.enum(["personal", "business"]) }),
  output: z.object({ entityId: z.string() }),
  handler: async (ctx, input) => {
    const shim = new PgSupabaseShim(ctx.db);
    const result = await commitCreateEntity(shim, { ownerId: ctx.principal.userId, name: input.name, entityType: input.entityType });
    if ("error" in result) throw new Error(result.error);
    return result;
  },
});

async function findOpeningBalanceEquityAccountId(db: PoolClient, entityId: string): Promise<string | null> {
  const { rows } = await db.query(
    `select id from public.chart_of_accounts where entity_id = $1 and name = 'Opening Balance Equity' and is_default = true limit 1`,
    [entityId]
  );
  return rows[0]?.id ?? null;
}

export const financeImportAccounts = defineOperation({
  id: "finance.importAccounts",
  tool: "finance_import_accounts",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/import-accounts" },
  title: "Import a chart of accounts",
  description: "Upserts a batch of chart-of-accounts entries into any finance entity you can edit — new or already-existing, your choice; this never creates a new entity itself. Pass externalId (the source system's own id, e.g. QuickBooks') so re-running with the same accounts updates rather than duplicates, parentExternalId to preserve a parent/child hierarchy, and openingBalance to post a starting balance as of a cutover date (against the entity's Opening Balance Equity account).",
  input: z.object({ entityId: z.string(), accounts: z.array(stagedAccount).min(1).max(500) }),
  output: z.object({ imported: z.number(), accountIds: z.array(z.object({ externalId: z.string(), accountId: z.string() })) }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const shim = new PgSupabaseShim(ctx.db);
    const result = await commitAccounts(shim, input.entityId, input.accounts as StagedAccount[]);
    if ("error" in result) throw new Error(result.error);

    const withOpeningBalance = input.accounts.filter((a) => a.openingBalance && a.externalId);
    if (withOpeningBalance.length > 0) {
      const obEquityId = await findOpeningBalanceEquityAccountId(ctx.db, input.entityId);
      if (!obEquityId) throw new OpValidationError("This entity has no Opening Balance Equity account to post against.");
      for (const a of withOpeningBalance) {
        const accountId = result.externalIdToAccountId.get(a.externalId!);
        if (!accountId || !a.openingBalance) continue;
        const isDebitNormal = normalBalanceForType(a.accountType) === "debit";
        const magnitude = Math.abs(a.openingBalance.amount);
        const accountIsDebit = a.openingBalance.amount >= 0 ? isDebitNormal : !isDebitNormal;
        const posted = await postJournalEntry(shim, {
          entityId: input.entityId,
          entryDate: a.openingBalance.asOfDate,
          description: `Opening balance: ${a.name}`,
          sourceType: "opening_balance",
          createdBy: ctx.principal.userId,
          lines: accountIsDebit
            ? [{ accountId, debit: magnitude }, { accountId: obEquityId, credit: magnitude }]
            : [{ accountId, credit: magnitude }, { accountId: obEquityId, debit: magnitude }],
        });
        if ("error" in posted) throw new OpValidationError(posted.error);
      }
    }

    return {
      imported: input.accounts.length,
      accountIds: [...result.externalIdToAccountId.entries()].map(([externalId, accountId]) => ({ externalId, accountId })),
    };
  },
});

export const financeImportCustomers = defineOperation({
  id: "finance.importCustomers",
  tool: "finance_import_customers",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/import-customers" },
  title: "Import customers/vendors",
  description: "Upserts a batch of customers/vendors into a finance entity you can edit, keyed by externalId so re-running updates rather than duplicates.",
  input: z.object({ entityId: z.string(), customers: z.array(stagedCustomer).min(1).max(1000), source: z.enum(["quickbooks", "wave"]) }),
  output: z.object({ imported: z.number(), customerIds: z.array(z.object({ externalId: z.string(), customerId: z.string() })) }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const shim = new PgSupabaseShim(ctx.db);
    const result = await commitCustomers(shim, input.entityId, input.customers as StagedCustomer[], input.source);
    if ("error" in result) throw new Error(result.error);
    return {
      imported: input.customers.length,
      customerIds: [...result.externalIdToCustomerId.entries()].map(([externalId, customerId]) => ({ externalId, customerId })),
    };
  },
});

export const financeImportInvoices = defineOperation({
  id: "finance.importInvoices",
  tool: "finance_import_invoices",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/import-invoices" },
  title: "Import invoices",
  description: "Upserts a batch of invoices (with line items) into a finance entity you can edit, keyed by externalId. Import customers first if invoices reference a customerExternalId. This doesn't touch the ledger — only finance_import_payment (a separate call) records money actually received against an invoice.",
  input: z.object({ entityId: z.string(), invoices: z.array(stagedInvoice).min(1).max(500) }),
  output: z.object({ imported: z.number(), invoiceIds: z.array(z.object({ externalId: z.string(), invoiceId: z.string() })) }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const shim = new PgSupabaseShim(ctx.db);
    const result = await commitInvoiceBatch(shim, input.entityId, input.invoices as StagedInvoice[]);
    if ("error" in result) throw new Error(result.error);
    return {
      imported: input.invoices.length,
      invoiceIds: [...result.externalIdToInvoiceId.entries()].map(([externalId, invoiceId]) => ({ externalId, invoiceId })),
    };
  },
});

export const financeImportPayment = defineOperation({
  id: "finance.importPayment",
  tool: "finance_import_payment",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/import-payment" },
  title: "Record a payment against an imported invoice",
  description: "Records that an already-imported invoice (by externalId) was paid — posts the ledger entry and updates the invoice's paid/partial status. The invoice must already exist (call finance_import_invoices first).",
  input: z.object({
    entityId: z.string(),
    invoiceExternalId: z.string(),
    amount: z.number().positive(),
    paidDate: z.string(),
    moneyAccountExternalId: z.string().optional(),
  }),
  output: z.object({ success: z.literal(true) }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const shim = new PgSupabaseShim(ctx.db);
    const payment: StagedPayment = {
      invoiceExternalId: input.invoiceExternalId,
      amount: input.amount,
      paidDate: input.paidDate,
      moneyAccountExternalId: input.moneyAccountExternalId,
    };
    const result = await commitPayment(shim, input.entityId, ctx.principal.userId, payment);
    if ("error" in result) throw new Error(result.error);
    return result;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Batch transaction + journal-entry import, modeled on a real connected
// assistant's own spec (an AI bookkeeping client requested this exact
// shape after using the single-row v1 of this tool to reconcile a real
// year of QuickBooks data). Per-row errors are collected and returned
// rather than aborting the whole batch — a bad row in a 500-row import
// shouldn't block the other 499.
// ─────────────────────────────────────────────────────────────────────────

const stagedSplit = z.object({ accountExternalId: z.string(), amount: z.number().positive(), memo: z.string().optional() });

const stagedTransaction = z.object({
  externalId: z.string(),
  date: z.string(),
  payee: z.string().optional(),
  vendorExternalId: z.string().optional(),
  memo: z.string().optional(),
  moneyAccountExternalId: z.string(),
  amount: z.number(),
  splits: z.array(stagedSplit).optional(),
  categoryAccountExternalId: z.string().optional(),
  isTransfer: z.boolean().optional(),
  transferAccountExternalId: z.string().optional(),
  cleared: z.boolean().optional(),
  reconciled: z.boolean().optional(),
});

type RowOutcome = { externalId: string; status: "created" | "updated" | "skipped"; transactionId?: string } | { externalId: string; status: "error"; error: string };

/** Deletes whatever ledger entry currently backs an already-imported
 * transaction (if any) so it can be reposted fresh — same "replace
 * wholesale on a re-run" reasoning commitInvoiceBatch already uses for
 * line items, just one level deeper (the journal entry, not just a
 * child row). Deleting the journal entry cascades its lines and nulls
 * out transactions.journal_entry_id (ON DELETE SET NULL) by itself. */
async function clearExistingJournalEntry(db: PoolClient, transactionId: string): Promise<void> {
  const { rows } = await db.query(`select journal_entry_id from public.transactions where id = $1`, [transactionId]);
  const journalEntryId = rows[0]?.journal_entry_id;
  if (journalEntryId) await db.query(`delete from public.journal_entries where id = $1`, [journalEntryId]);
  await db.query(`delete from public.transaction_splits where transaction_id = $1`, [transactionId]);
}

export const financeImportTransactions = defineOperation({
  id: "finance.importTransactions",
  tool: "finance_import_transactions",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/import-transactions" },
  title: "Import bank/card transactions (batch)",
  description:
    "Posts up to 500 real bank/card transactions per call, each as a balanced ledger entry. amount is signed: positive means money came IN to moneyAccountExternalId, negative means money went OUT. Pass splits (each a positive amount, summing to abs(amount)) for a categorized/split transaction, or just categoryAccountExternalId for a single category. For a transfer or card payment between two of your own money accounts, set isTransfer + transferAccountExternalId instead of a category. Every account referenced must already exist (call finance_import_accounts first). externalId is the source system's own id — re-running with the same externalId updates that transaction in place rather than duplicating it. Rejected if the entity's books are locked through this date. Returns per-row created/updated/error status, never aborts the whole batch for one bad row.",
  input: z.object({ entityId: z.string(), source: z.enum(["quickbooks", "wave", "manual"]), transactions: z.array(stagedTransaction).min(1).max(500) }),
  output: z.object({
    created: z.number(),
    updated: z.number(),
    errors: z.number(),
    results: z.array(
      z.union([
        z.object({ externalId: z.string(), status: z.enum(["created", "updated", "skipped"]), transactionId: z.string().optional() }),
        z.object({ externalId: z.string(), status: z.literal("error"), error: z.string() }),
      ])
    ),
  }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const shim = new PgSupabaseShim(ctx.db);
    const results: RowOutcome[] = [];

    for (const t of input.transactions) {
      try {
        const moneyAccountId = await findAccountIdByExternalId(shim, input.entityId, t.moneyAccountExternalId);
        if (!moneyAccountId) throw new Error(`moneyAccountExternalId "${t.moneyAccountExternalId}" not found`);

        let splits: { accountId: string; amount: number; memo?: string }[];
        if (t.isTransfer) {
          if (!t.transferAccountExternalId) throw new Error("isTransfer requires transferAccountExternalId");
          const transferAccountId = await findAccountIdByExternalId(shim, input.entityId, t.transferAccountExternalId);
          if (!transferAccountId) throw new Error(`transferAccountExternalId "${t.transferAccountExternalId}" not found`);
          splits = [{ accountId: transferAccountId, amount: Math.abs(t.amount) }];
        } else if (t.splits && t.splits.length > 0) {
          splits = [];
          for (const s of t.splits) {
            const accountId = await findAccountIdByExternalId(shim, input.entityId, s.accountExternalId);
            if (!accountId) throw new Error(`splits accountExternalId "${s.accountExternalId}" not found`);
            splits.push({ accountId, amount: s.amount, memo: s.memo });
          }
          const splitTotal = Math.round(splits.reduce((sum, s) => sum + s.amount, 0) * 100) / 100;
          if (splitTotal !== Math.round(Math.abs(t.amount) * 100) / 100) {
            throw new Error(`splits total (${splitTotal}) doesn't match abs(amount) (${Math.abs(t.amount)})`);
          }
        } else if (t.categoryAccountExternalId) {
          const accountId = await findAccountIdByExternalId(shim, input.entityId, t.categoryAccountExternalId);
          if (!accountId) throw new Error(`categoryAccountExternalId "${t.categoryAccountExternalId}" not found`);
          splits = [{ accountId, amount: Math.abs(t.amount) }];
        } else {
          throw new Error("Provide splits, categoryAccountExternalId, or isTransfer+transferAccountExternalId");
        }

        let payeeName = t.payee;
        if (!payeeName && t.vendorExternalId) {
          const vendor = await findCustomerIdByExternalId(shim, input.entityId, t.vendorExternalId);
          payeeName = vendor?.name;
        }
        payeeName = payeeName ?? "Imported transaction";

        const { rows: existingRows } = await ctx.db.query(
          `select id from public.transactions where entity_id = $1 and external_id = $2`,
          [input.entityId, t.externalId]
        );
        const existingId = existingRows[0]?.id as string | undefined;

        if (existingId) {
          await clearExistingJournalEntry(ctx.db, existingId);
          await ctx.db.query(
            `update public.transactions set date = $1, payee_name = $2, amount = $3, money_account_id = $4,
               is_split = $5, notes = $6, cleared_at = $7, source = $8
             where id = $9`,
            [t.date, payeeName, t.amount, moneyAccountId, splits.length > 1, t.memo ?? null, t.cleared || t.reconciled ? new Date().toISOString() : null, input.source, existingId]
          );
          const posted = await postJournalEntry(shim, {
            entityId: input.entityId,
            entryDate: t.date,
            description: payeeName,
            sourceType: "import",
            sourceTransactionId: existingId,
            createdBy: ctx.principal.userId,
            lines: buildTransferOrSplitLines(moneyAccountId, t.amount, splits),
          });
          if ("error" in posted) throw new Error(posted.error);
          await ctx.db.query(`update public.transactions set journal_entry_id = $1 where id = $2`, [posted.journalEntryId, existingId]);
          for (const s of splits) {
            await ctx.db.query(
              `insert into public.transaction_splits (transaction_id, chart_account_id, amount, memo) values ($1, $2, $3, $4)`,
              [existingId, s.accountId, s.amount, s.memo ?? null]
            );
          }
          results.push({ externalId: t.externalId, status: "updated", transactionId: existingId });
        } else {
          const posted = await postImportedTransaction(shim, {
            entityId: input.entityId,
            moneyAccountId,
            date: t.date,
            payeeName,
            amount: t.amount,
            splits,
            createdBy: ctx.principal.userId,
            sourceType: "import",
            externalId: t.externalId,
            source: input.source,
            notes: t.memo,
            clearedAt: t.cleared || t.reconciled ? new Date().toISOString() : null,
          });
          if ("error" in posted) throw new Error(posted.error);
          results.push({ externalId: t.externalId, status: "created", transactionId: posted.transactionId });
        }
      } catch (err) {
        results.push({ externalId: t.externalId, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return {
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };
  },
});

function buildTransferOrSplitLines(moneyAccountId: string, amount: number, splits: { accountId: string; amount: number; memo?: string }[]) {
  const magnitude = Math.abs(amount);
  const moneyLine = amount > 0 ? { accountId: moneyAccountId, debit: magnitude } : { accountId: moneyAccountId, credit: magnitude };
  const otherLines = splits.map((s) => (amount > 0 ? { accountId: s.accountId, credit: s.amount, memo: s.memo } : { accountId: s.accountId, debit: s.amount, memo: s.memo }));
  return [moneyLine, ...otherLines];
}

const stagedJournalLine = z.object({ accountExternalId: z.string(), debit: z.number().min(0).default(0), credit: z.number().min(0).default(0), memo: z.string().optional() });
const stagedJournalEntry = z.object({
  externalId: z.string(),
  date: z.string(),
  memo: z.string().optional(),
  lines: z.array(stagedJournalLine).min(2),
});

export const financeImportJournalEntries = defineOperation({
  id: "finance.importJournalEntries",
  tool: "finance_import_journal_entries",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/import-journal-entries" },
  title: "Import journal entries (batch)",
  description:
    "Posts up to 500 raw journal entries per call — for accruals, depreciation, and other adjustments that aren't a bank/card transaction. Each entry's lines must have debits equal credits in total, and each line must be either a debit or a credit, never both. externalId is the source system's own id; re-running with the same externalId updates that entry in place. Rejected if the entity's books are locked through this date.",
  input: z.object({ entityId: z.string(), source: z.enum(["quickbooks", "wave", "manual"]), entries: z.array(stagedJournalEntry).min(1).max(500) }),
  output: z.object({
    created: z.number(),
    updated: z.number(),
    errors: z.number(),
    results: z.array(
      z.union([
        z.object({ externalId: z.string(), status: z.enum(["created", "updated"]), journalEntryId: z.string().optional() }),
        z.object({ externalId: z.string(), status: z.literal("error"), error: z.string() }),
      ])
    ),
  }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const shim = new PgSupabaseShim(ctx.db);
    type JeOutcome = { externalId: string; status: "created" | "updated"; journalEntryId?: string } | { externalId: string; status: "error"; error: string };
    const results: JeOutcome[] = [];

    for (const e of input.entries) {
      try {
        const lines: { accountId: string; debit?: number; credit?: number; memo?: string }[] = [];
        for (const l of e.lines) {
          const accountId = await findAccountIdByExternalId(shim, input.entityId, l.accountExternalId);
          if (!accountId) throw new Error(`accountExternalId "${l.accountExternalId}" not found`);
          lines.push({ accountId, debit: l.debit || undefined, credit: l.credit || undefined, memo: l.memo });
        }

        const { rows: existingRows } = await ctx.db.query(
          `select id from public.journal_entries where entity_id = $1 and external_id = $2`,
          [input.entityId, e.externalId]
        );
        const existingId = existingRows[0]?.id as string | undefined;
        if (existingId) await ctx.db.query(`delete from public.journal_entries where id = $1`, [existingId]);

        const posted = await postJournalEntry(shim, {
          entityId: input.entityId,
          entryDate: e.date,
          description: e.memo,
          sourceType: "import",
          createdBy: ctx.principal.userId,
          lines,
          externalId: e.externalId,
          source: input.source,
        });
        if ("error" in posted) throw new Error(posted.error);
        results.push({ externalId: e.externalId, status: existingId ? "updated" : "created", journalEntryId: posted.journalEntryId });
      } catch (err) {
        results.push({ externalId: e.externalId, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return {
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };
  },
});

export const financeDeleteImport = defineOperation({
  id: "finance.deleteImport",
  tool: "finance_delete_import",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/delete-import" },
  title: "Undo an import batch",
  description: "Reverses a batch of previously-imported transactions and/or journal entries by their externalId, scoped to one source — so a bad batch can be undone without touching anything imported from elsewhere. Pass dryRun:true first to see what would be deleted without actually deleting anything.",
  input: z.object({ entityId: z.string(), source: z.enum(["quickbooks", "wave", "manual"]), externalIds: z.array(z.string()).min(1).max(500), dryRun: z.boolean().optional() }),
  output: z.object({
    transactionsDeleted: z.number(),
    journalEntriesDeleted: z.number(),
    dryRun: z.boolean(),
  }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const dryRun = input.dryRun ?? false;

    const { rows: txnRows } = await ctx.db.query(
      `select id from public.transactions where entity_id = $1 and source = $2 and external_id = any($3::text[])`,
      [input.entityId, input.source, input.externalIds]
    );
    const { rows: jeRows } = await ctx.db.query(
      `select id from public.journal_entries where entity_id = $1 and source = $2 and external_id = any($3::text[]) and source_transaction_id is null`,
      [input.entityId, input.source, input.externalIds]
    );

    if (!dryRun) {
      for (const t of txnRows) {
        await clearExistingJournalEntry(ctx.db, t.id);
        await ctx.db.query(`delete from public.transactions where id = $1`, [t.id]);
      }
      for (const je of jeRows) {
        await ctx.db.query(`delete from public.journal_entries where id = $1`, [je.id]);
      }
    }

    return { transactionsDeleted: txnRows.length, journalEntriesDeleted: jeRows.length, dryRun };
  },
});

export const financeWriteOperations = [
  financeCreateEntity,
  financeImportAccounts,
  financeImportCustomers,
  financeImportInvoices,
  financeImportPayment,
  financeImportTransactions,
  financeImportJournalEntries,
  financeDeleteImport,
];
