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
    .select("id")
    .eq("id", moneyAccountId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: "Account not found on this entity" }, { status: 400 });

  const text = await file.text();
  const { transactions, skipped, errors } = parseTransactionsCsv(text);
  if (transactions.length === 0) {
    return NextResponse.json({ error: errors[0] ?? "No transactions found in that file", imported: 0, skipped }, { status: 400 });
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

  return NextResponse.json({ imported: count ?? transactions.length, skipped, errors });
}
