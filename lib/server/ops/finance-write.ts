import { z } from "zod";
import type { PoolClient } from "pg";
import { defineOperation } from "@/lib/server/contract/operation";
import { PgSupabaseShim } from "@/lib/server/db/supabase-shim";
import {
  commitCreateEntity,
  commitAccounts,
  commitCustomers,
  commitInvoiceBatch,
  commitPayment,
  type StagedAccount,
  type StagedCustomer,
  type StagedInvoice,
  type StagedPayment,
} from "@/lib/finance/import-commit";

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
  description: "Creates a brand-new finance entity (books) for an import to target — imports always create a new entity rather than merging into an existing one, to avoid chart-of-accounts collisions. Seeds only the fallback accounts (Uncategorized Expense, etc.); call finance_import_accounts next with the real chart of accounts.",
  input: z.object({ name: z.string().min(1).max(200), entityType: z.enum(["personal", "business"]) }),
  output: z.object({ entityId: z.string() }),
  handler: async (ctx, input) => {
    const shim = new PgSupabaseShim(ctx.db);
    const result = await commitCreateEntity(shim, { ownerId: ctx.principal.userId, name: input.name, entityType: input.entityType });
    if ("error" in result) throw new Error(result.error);
    return result;
  },
});

export const financeImportAccounts = defineOperation({
  id: "finance.importAccounts",
  tool: "finance_import_accounts",
  module: "finance",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/finance/entities/:entityId/import-accounts" },
  title: "Import a chart of accounts",
  description: "Upserts a batch of chart-of-accounts entries into a finance entity you can edit. Pass externalId (the source system's own id, e.g. QuickBooks') so re-running with the same accounts updates rather than duplicates, and parentExternalId to preserve a parent/child account hierarchy.",
  input: z.object({ entityId: z.string(), accounts: z.array(stagedAccount).min(1).max(500) }),
  output: z.object({ imported: z.number(), accountIds: z.array(z.object({ externalId: z.string(), accountId: z.string() })) }),
  handler: async (ctx, input) => {
    await requireEditorRole(ctx.db, input.entityId, ctx.principal.userId);
    const shim = new PgSupabaseShim(ctx.db);
    const result = await commitAccounts(shim, input.entityId, input.accounts as StagedAccount[]);
    if ("error" in result) throw new Error(result.error);
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

export const financeWriteOperations = [
  financeCreateEntity,
  financeImportAccounts,
  financeImportCustomers,
  financeImportInvoices,
  financeImportPayment,
];
