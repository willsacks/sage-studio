import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { getPlaidClient } from "@/lib/finance/plaid-client";
import { decryptPlaidToken } from "@/lib/crypto";
import { postJournalEntry, reverseJournalEntry } from "@/lib/finance/ledger";
import { buildJournalLines } from "@/lib/finance/categorize";

type Rule = {
  id: string;
  match_type: "contains" | "exact" | "starts_with";
  match_value: string;
  chart_account_id: string;
  default_project_id: string | null;
  priority: number;
};

function matchesRule(payeeName: string, rule: Rule): boolean {
  const name = payeeName.toLowerCase();
  const value = rule.match_value.toLowerCase();
  if (rule.match_type === "exact") return name === value;
  if (rule.match_type === "starts_with") return name.startsWith(value);
  return name.includes(value);
}

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

        // Auto-categorize via the entity's rules, highest priority first.
        const { data: rules } = await supabase
          .from("categorization_rules")
          .select("*")
          .eq("entity_id", bankAccount.entity_id)
          .order("priority", { ascending: true });
        const matchedRule = ((rules ?? []) as Rule[]).find((r) => matchesRule(payeeName, r));
        if (matchedRule && bankAccount.chart_account_id) {
          const posted = await postJournalEntry(supabase, {
            entityId: bankAccount.entity_id,
            entryDate: txn.date,
            description: payeeName,
            sourceType: "bank_transaction",
            sourceTransactionId: transactionId,
            createdBy: connection.owner_id,
            lines: buildJournalLines(bankAccount.chart_account_id, amount, [
              { accountId: matchedRule.chart_account_id, amount: Math.abs(amount), projectId: matchedRule.default_project_id ?? undefined },
            ]),
          });
          if (!("error" in posted)) {
            await supabase.from("transaction_splits").insert({
              transaction_id: transactionId,
              chart_account_id: matchedRule.chart_account_id,
              project_id: matchedRule.default_project_id,
              amount: Math.abs(amount),
            });
            await supabase
              .from("transactions")
              .update({ status: "categorized", journal_entry_id: posted.journalEntryId })
              .eq("id", transactionId);
          }
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
