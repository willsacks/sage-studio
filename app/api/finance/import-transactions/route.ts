import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { parseTransactionsCsv } from "@/lib/finance/csv-import";

// Route Handler rather than a Server Action — a CSV of a few thousand rows
// can trip the Flight-protocol size limit on Server Action arguments, same
// reasoning as app/api/newsletter/import-contacts/route.ts.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const entityId = formData.get("entityId");
  const moneyAccountId = formData.get("moneyAccountId");

  if (!(file instanceof File) || typeof entityId !== "string" || typeof moneyAccountId !== "string") {
    return NextResponse.json({ error: "file, entityId, and moneyAccountId are required" }, { status: 400 });
  }

  try {
    await requireFinanceEntityRole(supabase, entityId, user.id, "editor");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: account } = await supabase
    .from("chart_of_accounts")
    .select("id, account_subtype")
    .eq("id", moneyAccountId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: "Account not found on this entity" }, { status: 400 });
  // The client dropdown already filters to money accounts, but the request
  // body is attacker-controlled — an income/expense account here would post
  // real debits/credits against the wrong side of the ledger later, when
  // categorizeTransaction falls back to this transaction's money_account_id.
  if (!["Cash and Bank", "Credit Card"].includes(account.account_subtype)) {
    return NextResponse.json({ error: "Choose a cash or credit card account, not a category" }, { status: 400 });
  }

  const text = await file.text();
  const { transactions, skipped, errors } = parseTransactionsCsv(text);
  if (transactions.length === 0) {
    const summary = errors.length > 0
      ? `No valid rows found. ${errors.slice(0, 3).join("; ")}${skipped > errors.length ? ` (+${skipped - errors.length} more)` : ""}`
      : "No transactions found in that file";
    return NextResponse.json({ error: summary, imported: 0, skipped, errors }, { status: 400 });
  }

  const { error: insertError, count } = await supabase
    .from("transactions")
    .insert(
      transactions.map((t) => ({
        entity_id: entityId,
        money_account_id: moneyAccountId,
        date: t.date,
        payee_name: t.payeeName,
        amount: t.amount,
        status: "uncategorized" as const,
      })),
      { count: "exact" }
    );
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  if (!count) {
    return NextResponse.json({ error: "No transactions were saved — you may not have permission to add transactions to this entity" }, { status: 403 });
  }

  return NextResponse.json({ imported: count, skipped, errors });
}
