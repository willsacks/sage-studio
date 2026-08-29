import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import {
  PERSONAL_DEFAULT_ACCOUNTS,
  BUSINESS_DEFAULT_ACCOUNTS,
  normalBalanceForType,
  type DefaultAccount,
} from "@/lib/finance/default-accounts";

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

/** Bulk-inserts an imported chart of accounts, returning a map from each
 * account's externalId to its new chart_of_accounts.id (used by later
 * phases to resolve transaction/invoice line references). Two-pass:
 * accounts are inserted first with no parent, then parent_account_id is
 * backfilled once every row exists, so the source system's ordering of
 * parent/child accounts doesn't matter. Uses upsert on (entity_id, name) —
 * a plain unique constraint on name isn't declared today, so this relies on
 * an application-level check-then-insert instead; see inline comment. */
export async function commitAccounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  entityId: string,
  accounts: StagedAccount[]
): Promise<{ externalIdToAccountId: Map<string, string> } | { error: string }> {
  const externalIdToAccountId = new Map<string, string>();
  if (accounts.length === 0) return { externalIdToAccountId };

  // Retries (a resumed/re-run import) shouldn't create duplicate rows for
  // accounts already committed in a prior attempt — check existing
  // external_id-tagged accounts for this entity first via a lookup on name,
  // since chart_of_accounts has no external_id column of its own (unlike
  // finance_customers) and existing schema shouldn't be widened just for
  // this. Sage Studio account names are unique per entity in practice
  // (the manual-entry UI never creates duplicates), so name is a safe key.
  const { data: existing } = await supabase.from("chart_of_accounts").select("id, name").eq("entity_id", entityId);
  const existingByName = new Map<string, string>((existing ?? []).map((a: { id: string; name: string }) => [a.name, a.id]));

  const toInsert = accounts.filter((a) => !existingByName.has(a.name));
  for (const a of accounts) {
    if (existingByName.has(a.name) && a.externalId) externalIdToAccountId.set(a.externalId, existingByName.get(a.name)!);
  }

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("chart_of_accounts")
      .insert(
        toInsert.map((a) => ({
          entity_id: entityId,
          name: a.name,
          account_type: a.accountType,
          account_subtype: a.accountSubtype,
          normal_balance: normalBalanceForType(a.accountType),
          is_default: false,
        }))
      )
      .select("id, name");
    if (error) return { error: error.message };
    for (const row of inserted as { id: string; name: string }[]) {
      const source = toInsert.find((a) => a.name === row.name);
      if (source?.externalId) externalIdToAccountId.set(source.externalId, row.id);
    }
  }

  // Second pass: resolve parent_account_id now that every account (old and
  // newly-inserted) has a known id.
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
