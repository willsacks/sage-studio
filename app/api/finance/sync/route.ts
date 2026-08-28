import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { syncBankConnection } from "@/lib/finance/plaid-sync";

// Route Handler rather than a Server Action: a full-history sync can return
// a large number of transactions, and both a Server Action's arguments and
// its response are decoded through React's Flight protocol, which has a
// hard ~1M-unit size limit unrelated to bodySizeLimit config — same
// reasoning as app/api/newsletter/import-contacts/route.ts.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const bankConnectionId = body?.bankConnectionId;
  const entityId = body?.entityId;
  if (!bankConnectionId || !entityId) {
    return NextResponse.json({ error: "bankConnectionId and entityId are required" }, { status: 400 });
  }

  try {
    await requireFinanceEntityRole(supabase, entityId, user.id, "editor");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: connection } = await supabase
    .from("bank_connections")
    .select("id")
    .eq("id", bankConnectionId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!connection) return NextResponse.json({ error: "Bank connection not found" }, { status: 404 });

  const result = await syncBankConnection(supabase, bankConnectionId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
