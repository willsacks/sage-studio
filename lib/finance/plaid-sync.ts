import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { getPlaidClient } from "@/lib/finance/plaid-client";
import { decryptPlaidToken } from "@/lib/crypto";
import { reverseJournalEntry } from "@/lib/finance/ledger";
import { applyMatchingRule } from "@/lib/finance/categorization-rules";

/** Pulls new/changed/removed transactions for one bank connection via
 * Plaid's cursor-based /transactions/sync, applies any matching
 * categorization rule immediately (auto-categorized, journal entry
 * generated right away — never left silently uncategorized if a rule
 * exists), and advances the stored cursor. Shared by the authenticated
 * manual-sync route and the Plaid webhook receiver — both just need a
 * bank_connection_id and a service-capable Supabase client. */
export async function syncBankConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  bankConnectionId: string
): Promise<{ added: number; modified: number; removed: number } | { error: string }> {
  const { data: connection, error: connectionError } = await supabase
    .from("bank_connections")
    .select("id, owner_id, plaid_access_token_encrypted, plaid_cursor")
    .eq("id", bankConnectionId)
    .single();
  if (connectionError || !connection) return { error: connectionError?.message ?? "Bank connection not found" };

  let accessToken: string;
  try {
    accessToken = decryptPlaidToken(connection.plaid_access_token_encrypted);
  } catch {
    return { error: "Could not decrypt access token" };
  }

  const plaid = getPlaidClient();
  let cursor: string | undefined = connection.plaid_cursor ?? undefined;
  let hasMore = true;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;

  type MappedBankAccount = { id: string; entity_id: string; plaid_account_id: string; chart_account_id: string | null };
  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("id, entity_id, plaid_account_id, chart_account_id")
    .eq("bank_connection_id", bankConnectionId);
  const accountByPlaidId = new Map<string, MappedBankAccount>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((bankAccounts ?? []) as any[]).map((a) => [a.plaid_account_id as string, a as MappedBankAccount])
  );

  try {
    while (hasMore) {
      const response = await plaid.transactionsSync({ access_token: accessToken, cursor });
      const { added, modified, removed, next_cursor, has_more } = response.data;

      for (const txn of [...added, ...modified]) {
        const bankAccount = accountByPlaidId.get(txn.account_id);
        if (!bankAccount) continue; // account not yet mapped into bank_accounts — skip until it is

        const amount = -txn.amount; // Plaid: positive = outflow. Ours: positive = cash in.
        const payeeName = txn.merchant_name || txn.name;

        const { data: existing } = await supabase
          .from("transactions")
          .select("id, journal_entry_id")
          .eq("plaid_transaction_id", txn.transaction_id)
          .maybeSingle();

        let transactionId: string;
        if (existing) {
          await supabase
            .from("transactions")
            .update({ date: txn.date, payee_name: payeeName, amount })
            .eq("id", existing.id);
          transactionId = existing.id;
          modifiedCount++;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("transactions")
            .insert({
              entity_id: bankAccount.entity_id,
              bank_account_id: bankAccount.id,
              plaid_transaction_id: txn.transaction_id,
              date: txn.date,
              payee_name: payeeName,
              amount,
              status: "uncategorized",
            })
            .select("id")
            .single();
          if (insertError || !inserted) continue;
          transactionId = inserted.id;
          addedCount++;
        }

        // Auto-categorize via the entity's rules, highest priority first —
        // never left silently uncategorized if a rule already matches.
        if (bankAccount.chart_account_id) {
          await applyMatchingRule(supabase, {
            entityId: bankAccount.entity_id,
            transactionId,
            moneyAccountId: bankAccount.chart_account_id,
            payeeName,
            amount,
            date: txn.date,
            createdBy: connection.owner_id,
          });
        }
      }

      for (const removedTxn of removed) {
        const { data: existing } = await supabase
          .from("transactions")
          .select("id, journal_entry_id")
          .eq("plaid_transaction_id", removedTxn.transaction_id)
          .maybeSingle();
        if (existing) {
          if (existing.journal_entry_id) {
            await reverseJournalEntry(supabase, existing.journal_entry_id, connection.owner_id);
          }
          await supabase.from("transactions").delete().eq("id", existing.id);
          removedCount++;
        }
      }

      cursor = next_cursor;
      hasMore = has_more;
    }
  } catch (err) {
    await supabase.from("bank_connections").update({ status: "error" }).eq("id", bankConnectionId);
    return { error: err instanceof Error ? err.message : "Plaid sync failed" };
  }

  await supabase
    .from("bank_connections")
    .update({ plaid_cursor: cursor, last_synced_at: new Date().toISOString(), status: "active" })
    .eq("id", bankConnectionId);

  return { added: addedCount, modified: modifiedCount, removed: removedCount };
}
