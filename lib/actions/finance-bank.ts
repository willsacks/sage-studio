"use server";

import { revalidatePath } from "next/cache";
import { CountryCode, Products } from "plaid";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { getPlaidClient } from "@/lib/finance/plaid-client";
import { encryptPlaidToken } from "@/lib/crypto";
import { normalBalanceForType } from "@/lib/finance/default-accounts";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function createPlaidLinkToken(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";

  try {
    const plaid = getPlaidClient();
    const response = await plaid.linkTokenCreate({
      client_name: "Sage Studio",
      language: "en",
      country_codes: [CountryCode.Us],
      user: { client_user_id: user.id },
      products: [Products.Transactions],
      // Without this, Plaid never calls our webhook route and incremental
      // sync only ever happens when the user manually clicks "sync".
      webhook: `${appUrl}/api/finance/webhooks/plaid`,
      // Only OAuth-based institutions (most major US banks) need this, and
      // Plaid rejects the request if a redirect_uri is passed that isn't
      // registered in the Dashboard — so this stays unset until
      // PLAID_REDIRECT_URI is actually configured there (see
      // app/(dashboard)/finances/plaid-oauth/page.tsx for the other half
      // of this flow).
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    });
    return { linkToken: response.data.link_token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create Plaid link token" };
  }
}

export async function exchangePlaidPublicToken(params: { entityId: string; publicToken: string }) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  try {
    const plaid = getPlaidClient();
    const exchange = await plaid.itemPublicTokenExchange({ public_token: params.publicToken });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    const accountsResponse = await plaid.accountsGet({ access_token: accessToken });
    const institutionName = accountsResponse.data.item.institution_name ?? "Bank";

    const { data: connection, error: connectionError } = await supabase
      .from("bank_connections")
      .insert({
        owner_id: user.id,
        plaid_item_id: itemId,
        plaid_access_token_encrypted: encryptPlaidToken(accessToken),
        institution_name: institutionName,
      })
      .select("id")
      .single();
    if (connectionError || !connection) return { error: connectionError?.message ?? "Failed to store bank connection" };

    const { error: accountsError } = await supabase.from("bank_accounts").insert(
      accountsResponse.data.accounts.map((a) => ({
        bank_connection_id: connection.id,
        entity_id: params.entityId,
        plaid_account_id: a.account_id,
        name: a.name,
        mask: a.mask,
        account_type: a.subtype ?? a.type,
        current_balance: a.balances.current,
        available_balance: a.balances.available,
      }))
    );
    if (accountsError) return { error: accountsError.message };

    revalidatePath("/finances");
    return { bankConnectionId: connection.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to connect bank account" };
  }
}

/** Adds a money account that isn't Plaid-connected (cash, a bank that
 * isn't supported, a manual ledger someone keeps by hand) — and, unlike the
 * plain chart-of-accounts-only "add manually" path this replaces, also
 * creates the bank_accounts row reconciliation depends on. Without this,
 * reconciliation (lib/actions/finance-reconciliation.ts) was only reachable
 * for Plaid-linked accounts, since the Reconcile button only ever appears
 * next to a bank_accounts row — a real gap for anyone not using Plaid at
 * all. The paired bank_connections row is a placeholder (institution_name
 * "Manual entry", a non-functional token) purely to satisfy the NOT NULL
 * schema built around Plaid; the UI hides the Sync button for it since
 * there's nothing to sync. */
export async function createManualMoneyAccount(params: {
  entityId: string;
  name: string;
  accountSubtype: "Cash and Bank" | "Credit Card" | "Investment";
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  const name = params.name.trim();
  if (!name) return { error: "A name is required" };
  const accountType = params.accountSubtype === "Credit Card" ? "liability" : "asset";

  const { data: chartAccount, error: chartError } = await supabase
    .from("chart_of_accounts")
    .insert({
      entity_id: params.entityId,
      name,
      account_type: accountType,
      account_subtype: params.accountSubtype,
      normal_balance: normalBalanceForType(accountType),
    })
    .select("id")
    .single();
  if (chartError || !chartAccount) return { error: chartError?.message ?? "Failed to create account" };

  const placeholderId = crypto.randomUUID();
  const { data: connection, error: connectionError } = await supabase
    .from("bank_connections")
    .insert({
      owner_id: user.id,
      plaid_item_id: `manual-${placeholderId}`,
      plaid_access_token_encrypted: "manual-account-no-token",
      institution_name: "Manual entry",
      status: "active",
    })
    .select("id")
    .single();
  if (connectionError || !connection) {
    await supabase.from("chart_of_accounts").delete().eq("id", chartAccount.id);
    return { error: connectionError?.message ?? "Failed to create account" };
  }

  const { error: bankAccountError } = await supabase.from("bank_accounts").insert({
    bank_connection_id: connection.id,
    entity_id: params.entityId,
    chart_account_id: chartAccount.id,
    plaid_account_id: `manual-${placeholderId}`,
    name,
  });
  if (bankAccountError) {
    await supabase.from("bank_connections").delete().eq("id", connection.id);
    await supabase.from("chart_of_accounts").delete().eq("id", chartAccount.id);
    return { error: bankAccountError.message };
  }

  revalidatePath("/finances");
  return { accountId: chartAccount.id as string };
}

export async function listBankConnections(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*, bank_connections(institution_name, status, last_synced_at)")
    .eq("entity_id", entityId)
    .eq("is_active", true);
  if (error) return { error: error.message, accounts: [] };
  return { accounts: data ?? [] };
}

export async function mapBankAccountToChartAccount(bankAccountId: string, entityId: string, chartAccountId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase
    .from("bank_accounts")
    .update({ chart_account_id: chartAccountId })
    .eq("id", bankAccountId)
    .eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

export async function unlinkBankAccount(bankAccountId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_active: false })
    .eq("id", bankAccountId)
    .eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}
