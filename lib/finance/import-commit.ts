import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import {
  PERSONAL_DEFAULT_ACCOUNTS,
  BUSINESS_DEFAULT_ACCOUNTS,
  normalBalanceForType,
  type DefaultAccount,
} from "@/lib/finance/default-accounts";
import { postImportedTransaction } from "@/lib/finance/ledger";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Common intermediate shape both the QuickBooks connector and the Wave CSV
 * wizard produce, so the "write into Sage Studio" logic exists exactly
 * once. QuickBooks feeds these functions phase-by-phase as paginated
 * results arrive; Wave's wizard calls them once after all CSVs are parsed. */
export type StagedAccount = {
  name: string;
  accountType: "asset" | "liability" | "equity" | "income" | "expense";
  accountSubtype: string;
  externalId?: string;
  parentExternalId?: string;
};

export type StagedCustomer = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  externalId?: string;
};

/** Every write in this file is scoped by an explicit entityId resolved once
 * at entity-creation time and threaded through every subsequent call — no
 * function here ever infers which entity to write to from anything other
 * than a caller-supplied id. */

/**
 * Creates the brand-new entity an import always targets (never merges into
 * an existing one — avoids chart-of-accounts collisions and double-counting).
 * Seeds ONLY the `is_default` fallback accounts (Uncategorized Expense,
 * Opening Balance Equity, Accounts Receivable for business entities) rather
 * than the full manual-entry starter template — those generic "Checking"/
 * "Groceries"-style rows would just clutter an entity whose real chart of
 * accounts is about to be imported on top. The importer's ledger-posting
 * logic (e.g. crediting Accounts Receivable for an imported Payment,
 * falling back to Uncategorized Expense) depends on these fallback rows
 * existing, so they're seeded even though most of each template is skipped.
 */
export async function commitCreateEntity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  params: { ownerId: string; name: string; entityType: "personal" | "business" }
): Promise<{ entityId: string } | { error: string }> {
  const { data: entity, error } = await supabase
    .from("finance_entities")
    .insert({ owner_id: params.ownerId, name: params.name, entity_type: params.entityType })
    .select("id")
    .single();
  if (error || !entity) return { error: error?.message ?? "Failed to create entity" };

  const template: DefaultAccount[] = params.entityType === "business" ? BUSINESS_DEFAULT_ACCOUNTS : PERSONAL_DEFAULT_ACCOUNTS;
  const fallbackAccounts = template.filter((a) => a.is_default);
  const { error: accountsError } = await supabase.from("chart_of_accounts").insert(
    fallbackAccounts.map((a) => ({
      entity_id: entity.id,
      name: a.name,
      account_type: a.account_type,
      account_subtype: a.account_subtype,
      normal_balance: normalBalanceForType(a.account_type),
      is_default: true,
      display_order: a.display_order,
    }))
  );
  if (accountsError) {
    await supabase.from("finance_entities").delete().eq("id", entity.id);
    return { error: `Failed to seed fallback accounts: ${accountsError.message}` };
  }

  return { entityId: entity.id as string };
}

/** Upserts an imported chart of accounts, returning a map from each
 * account's externalId to its new chart_of_accounts.id (used immediately
 * for parent-account resolution below, and by later phases — e.g. Payment/
 * Deposit — that re-query chart_of_accounts.external_id fresh from the DB,
 * since a resumed/self-re-invoked import can't rely on this map surviving
 * across requests).
 *
 * Matches each account by external_id first (already imported in a prior
 * run), then falls back to matching by name — a plain upsert keyed only on
 * (entity_id, external_id) will happily try to INSERT a new row for, say,
 * QuickBooks' own "Accounts Receivable" account, which collides with the
 * (entity_id, name) unique constraint against the fallback "Accounts
 * Receivable" row commitCreateEntity already seeded (external_id null) —
 * confirmed in production as `duplicate key value violates unique
 * constraint "chart_of_accounts_entity_id_name_key"`. Matching by name
 * first lets the import "claim" that pre-seeded row instead of colliding
 * with it. Row-by-row rather than a single bulk upsert — chart-of-accounts
 * sizes are small enough (tens to low hundreds of rows) that this isn't a
 * performance concern, and correctness here matters more than round-trips.
 *
 * Two-pass: accounts are committed first with no parent, then
 * parent_account_id is backfilled once every row exists, so the source
 * system's ordering of parent/child accounts doesn't matter. */
export async function commitAccounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  accounts: StagedAccount[]
): Promise<{ externalIdToAccountId: Map<string, string> } | { error: string }> {
  const externalIdToAccountId = new Map<string, string>();
  if (accounts.length === 0) return { externalIdToAccountId };

  for (const a of accounts) {
    let existingId: string | null = null;

    if (a.externalId) {
      const { data } = await supabase.from("chart_of_accounts").select("id").eq("entity_id", entityId).eq("external_id", a.externalId).maybeSingle();
      existingId = data?.id ?? null;
    }
    if (!existingId) {
      const { data } = await supabase.from("chart_of_accounts").select("id").eq("entity_id", entityId).eq("name", a.name).maybeSingle();
      existingId = data?.id ?? null;
    }

    if (existingId) {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({
          account_type: a.accountType,
          account_subtype: a.accountSubtype,
          normal_balance: normalBalanceForType(a.accountType),
          external_id: a.externalId ?? null,
        })
        .eq("id", existingId);
      if (error) return { error: error.message };
      if (a.externalId) externalIdToAccountId.set(a.externalId, existingId);
    } else {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .insert({
          entity_id: entityId,
          name: a.name,
          account_type: a.accountType,
          account_subtype: a.accountSubtype,
          normal_balance: normalBalanceForType(a.accountType),
          is_default: false,
          external_id: a.externalId ?? null,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      if (a.externalId) externalIdToAccountId.set(a.externalId, data.id);
    }
  }

  // Second pass: resolve parent_account_id now that every account has a
  // known id.
  const parentUpdates = accounts.filter((a) => a.externalId && a.parentExternalId);
  for (const a of parentUpdates) {
    const accountId = externalIdToAccountId.get(a.externalId!);
    const parentId = externalIdToAccountId.get(a.parentExternalId!);
    if (accountId && parentId) {
      await supabase.from("chart_of_accounts").update({ parent_account_id: parentId }).eq("id", accountId);
    }
  }

  return { externalIdToAccountId };
}

/** Looks up a chart_of_accounts id by its source-system external_id,
 * re-querying the DB rather than relying on an in-memory map — used by the
 * invoice/payment phases, which may run in a later self-re-invocation of
 * the chunked import than the one that committed the accounts. */
export async function findAccountIdByExternalId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  externalId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("entity_id", entityId)
    .eq("external_id", externalId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Looks up the entity's default fallback account for a given account_type
 * (e.g. the "Accounts Receivable" or "Uncategorized Expense" rows seeded by
 * commitCreateEntity) — used when an imported transaction's own account
 * can't be resolved, or (for Payment) as the intentional AR-crediting
 * target regardless of which bank account QuickBooks itself deposited to. */
export async function findDefaultAccountId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  accountSubtype: string
): Promise<string | null> {
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("entity_id", entityId)
    .eq("is_default", true)
    .eq("account_subtype", accountSubtype)
    .maybeSingle();
  return data?.id ?? null;
}

/** Bulk-inserts imported customers/vendors into the unified finance_customers
 * table. Uses upsert on (entity_id, external_id) — the DB-level unique
 * constraint added in scripts/add-import-schema.ts — so re-running an
 * import after a partial failure never creates duplicate contacts. */
export async function commitCustomers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  customers: StagedCustomer[],
  source: "quickbooks" | "wave"
): Promise<{ externalIdToCustomerId: Map<string, string> } | { error: string }> {
  const externalIdToCustomerId = new Map<string, string>();
  if (customers.length === 0) return { externalIdToCustomerId };

  const { data, error } = await supabase
    .from("finance_customers")
    .upsert(
      customers.map((c) => ({
        entity_id: entityId,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        external_id: c.externalId ?? null,
        source,
      })),
      { onConflict: "entity_id,external_id" }
    )
    .select("id, external_id");
  if (error) return { error: error.message };

  for (const row of data as { id: string; external_id: string | null }[]) {
    if (row.external_id) externalIdToCustomerId.set(row.external_id, row.id);
  }
  return { externalIdToCustomerId };
}

/** Looks up a finance_customers id by its source-system external_id,
 * re-querying the DB rather than relying on an in-memory map — same
 * cross-phase-survival reasoning as findAccountIdByExternalId. */
export async function findCustomerIdByExternalId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  externalId: string
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from("finance_customers")
    .select("id, name")
    .eq("entity_id", entityId)
    .eq("external_id", externalId)
    .maybeSingle();
  return data ?? null;
}

export type StagedInvoiceLineItem = { description: string; quantity: number; unitPrice: number };

export type StagedInvoice = {
  externalId: string;
  invoiceNumber?: string;
  customerExternalId?: string;
  issueDate: string;
  dueDate?: string;
  lineItems: StagedInvoiceLineItem[];
  taxAmount?: number;
  totalOverride?: number;
};

/** Bulk-upserts imported invoices + their line items. No ledger entry is
 * created here — matches how manually-created invoices already behave
 * (createInvoice never touches journal_entries); the ledger only gets
 * touched when a Payment is recorded against the invoice, in
 * commitPayment below. Upserts on (entity_id, external_id), so re-running
 * a resumed import updates rather than duplicates. */
export async function commitInvoiceBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  invoices: StagedInvoice[]
): Promise<{ externalIdToInvoiceId: Map<string, string> } | { error: string }> {
  const externalIdToInvoiceId = new Map<string, string>();
  if (invoices.length === 0) return { externalIdToInvoiceId };

  for (const inv of invoices) {
    const customer = inv.customerExternalId ? await findCustomerIdByExternalId(supabase, entityId, inv.customerExternalId) : null;
    const subtotal = round2(inv.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0));
    const taxAmount = round2(inv.taxAmount ?? 0);
    const total = inv.totalOverride ?? round2(subtotal + taxAmount);

    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("invoices")
      .upsert(
        {
          entity_id: entityId,
          external_id: inv.externalId,
          customer_id: customer?.id ?? null,
          client_name: customer?.name ?? "Imported customer",
          invoice_number: inv.invoiceNumber ?? `IMP-${inv.externalId}`,
          issue_date: inv.issueDate,
          due_date: inv.dueDate ?? null,
          status: "sent",
          subtotal,
          tax_amount: taxAmount,
          total,
        },
        { onConflict: "entity_id,external_id" }
      )
      .select("id")
      .single();
    if (invoiceError || !invoiceRow) return { error: invoiceError?.message ?? "Failed to import invoice" };

    externalIdToInvoiceId.set(inv.externalId, invoiceRow.id);

    // Line items are replaced wholesale on a re-run rather than merged —
    // simplest way to stay correct on a retry without diffing line items.
    await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceRow.id);
    if (inv.lineItems.length > 0) {
      const { error: lineItemsError } = await supabase.from("invoice_line_items").insert(
        inv.lineItems.map((li, i) => ({
          invoice_id: invoiceRow.id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unitPrice,
          amount: round2(li.quantity * li.unitPrice),
          display_order: i,
        }))
      );
      if (lineItemsError) return { error: lineItemsError.message };
    }
  }

  return { externalIdToInvoiceId };
}

export type StagedPayment = {
  invoiceExternalId: string;
  amount: number;
  paidDate: string;
  moneyAccountExternalId?: string;
};

/** Looks up an income-type account to credit for an imported payment. QBO's
 * Payment object doesn't carry a revenue category itself (that lives on the
 * Invoice's line items, tied to QBO Items, which aren't resolved by this
 * importer yet) — so every imported payment lands in one general account
 * rather than being split across the same categories the original invoice
 * used. Prefers the "Revenue" subtype (the bucket the accounts phase maps
 * QBO's own "Income" AccountType into) and falls back to any income
 * account on the entity. Real per-line-item categorization is a
 * reasonable future improvement, not something this import claims to do. */
async function findIncomeAccountId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string
): Promise<string | null> {
  const { data } = await supabase.from("chart_of_accounts").select("id, account_subtype").eq("entity_id", entityId).eq("account_type", "income");
  if (!data || data.length === 0) return null;
  const revenue = data.find((a: { id: string; account_subtype: string }) => a.account_subtype === "Revenue");
  return (revenue ?? data[0]).id;
}

/** Posts an imported payment against an already-imported invoice: credits
 * an income account (matching recordInvoicePayment's manual-entry
 * behavior — see findIncomeAccountId for how the specific account is
 * chosen) via postImportedTransaction, then inserts invoice_payments and
 * recomputes the invoice's status exactly like recordInvoicePayment does.
 *
 * An earlier version of this credited Accounts Receivable instead, on the
 * theory that an imported Payment is "reconciling an already-invoiced AR
 * balance" rather than recognizing new income. That reasoning doesn't
 * actually hold here: Sage Studio's invoices never post anything to the
 * ledger at invoice-time (commitInvoiceBatch is deliberately ledger-free,
 * matching how manually-created invoices behave) — so there's no
 * offsetting AR debit for a payment's AR credit to reconcile against.
 * Confirmed against a real QuickBooks sandbox import: crediting AR made
 * every imported payment invisible on the Income Statement, since that
 * report only sums income/expense account types. */
export async function commitPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  createdBy: string,
  payment: StagedPayment
): Promise<{ success: true } | { error: string }> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, total, client_name, invoice_number")
    .eq("entity_id", entityId)
    .eq("external_id", payment.invoiceExternalId)
    .maybeSingle();
  if (invoiceError) return { error: invoiceError.message };
  if (!invoice) return { error: `Payment references an invoice (${payment.invoiceExternalId}) that wasn't imported` };

  const incomeAccountId = await findIncomeAccountId(supabase, entityId);
  if (!incomeAccountId) return { error: "No income account found on this entity to credit this payment against" };

  let moneyAccountId = payment.moneyAccountExternalId ? await findAccountIdByExternalId(supabase, entityId, payment.moneyAccountExternalId) : null;
  if (!moneyAccountId) {
    // DepositToAccountRef wasn't resolvable — fall back to any imported
    // Cash and Bank account.
    const { data: fallbackAccount } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("entity_id", entityId)
      .eq("account_subtype", "Cash and Bank")
      .limit(1)
      .maybeSingle();
    moneyAccountId = fallbackAccount?.id ?? null;
  }
  if (!moneyAccountId) return { error: "No cash/bank account found to record this payment against" };

  const posted = await postImportedTransaction(supabase, {
    entityId,
    moneyAccountId,
    date: payment.paidDate,
    payeeName: `${invoice.invoice_number} — ${invoice.client_name}`,
    amount: payment.amount,
    splits: [{ accountId: incomeAccountId, amount: payment.amount }],
    createdBy,
    sourceType: "import",
  });
  if ("error" in posted) return { error: posted.error };

  const { error: paymentError } = await supabase.from("invoice_payments").insert({
    invoice_id: invoice.id,
    amount: payment.amount,
    paid_date: payment.paidDate,
    matched_transaction_id: posted.transactionId,
    journal_entry_id: posted.journalEntryId,
  });
  if (paymentError) return { error: paymentError.message };

  const { data: payments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", invoice.id);
  const totalPaid = round2((payments ?? []).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0));
  const newStatus = totalPaid >= invoice.total ? "paid" : "partial";
  await supabase.from("invoices").update({ status: newStatus }).eq("id", invoice.id);

  return { success: true };
}
