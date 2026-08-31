"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { postJournalEntry } from "@/lib/finance/ledger";
import { buildJournalLines, type SplitInput } from "@/lib/finance/categorize";
import { logFinanceAudit } from "@/lib/finance/audit";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type BillLineItemInput = { description: string; accountId: string; amount: number };

export async function listBills(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("bills")
    .select("*, bill_line_items(*), bill_payments(*)")
    .eq("entity_id", entityId)
    .order("bill_date", { ascending: false });
  if (error) return { error: error.message, bills: [] };
  return { bills: data ?? [] };
}

/** Vendor bill — accounts payable, mirroring how invoices (AR) work: the
 * bill itself is a lightweight tracking layer (open/partial/paid/void), and
 * only recording a payment against it touches the ledger. Unlike an
 * invoice's line items (which are just descriptive), a bill's line items
 * each carry their own expense account, since that's what a payment needs
 * to know which category(ies) to debit. */
export async function createBill(params: {
  entityId: string;
  projectId?: string;
  vendorName: string;
  billDate: string;
  dueDate?: string;
  notes?: string;
  lineItems: BillLineItemInput[];
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  if (!params.vendorName.trim()) return { error: "A vendor name is required" };
  const lineItems = params.lineItems.filter((li) => li.accountId && li.amount > 0);
  if (lineItems.length === 0) return { error: "Add at least one line item" };

  const total = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));

  const { count } = await supabase
    .from("bills")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", params.entityId);
  const billNumber = `BILL-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .insert({
      entity_id: params.entityId,
      project_id: params.projectId ?? null,
      vendor_name: params.vendorName.trim(),
      bill_number: billNumber,
      bill_date: params.billDate,
      due_date: params.dueDate || null,
      status: "open",
      subtotal: total,
      total,
      notes: params.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (billError || !bill) return { error: billError?.message ?? "Failed to create bill" };

  const { error: lineItemsError } = await supabase.from("bill_line_items").insert(
    lineItems.map((li, i) => ({
      bill_id: bill.id,
      description: li.description,
      account_id: li.accountId,
      amount: round2(li.amount),
      display_order: i,
    }))
  );
  if (lineItemsError) return { error: lineItemsError.message };

  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: user.id,
    action: "bill.created",
    targetTable: "bills",
    targetId: bill.id as string,
    diff: { vendorName: params.vendorName.trim(), total, lineItems },
  });

  revalidatePath("/finances");
  return { billId: bill.id as string };
}

export async function setBillStatus(billId: string, entityId: string, status: "void") {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("bills").update({ status }).eq("id", billId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  await logFinanceAudit(supabase, { entityId, actorId: user.id, action: "bill.voided", targetTable: "bills", targetId: billId });
  revalidatePath("/finances");
  return { success: true };
}

/** Records a payment against a bill — the only bill action that posts to
 * the ledger. Splits the payment across the bill's line-item accounts
 * proportionally to their share of the bill total (so a partial payment
 * still debits every category it touched, not just the first one), fixing
 * up rounding drift on the last line so the splits always sum exactly to
 * the payment amount — the same balance invariant buildJournalLines/
 * postJournalEntry enforce everywhere else. */
export async function recordBillPayment(params: {
  billId: string;
  entityId: string;
  amount: number;
  paidDate: string;
  moneyAccountId: string;
  method?: string;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select("id, project_id, vendor_name, bill_number, total")
    .eq("id", params.billId)
    .eq("entity_id", params.entityId)
    .single();
  if (billError || !bill) return { error: billError?.message ?? "Bill not found" };
  if (params.amount <= 0) return { error: "Payment amount must be positive" };

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("bill_line_items")
    .select("account_id, amount")
    .eq("bill_id", params.billId)
    .order("display_order", { ascending: true });
  if (lineItemsError || !lineItems || lineItems.length === 0) return { error: lineItemsError?.message ?? "Bill has no line items" };

  const fraction = params.amount / bill.total;
  let allocated = 0;
  const splits: SplitInput[] = lineItems.map((li) => {
    const amt = round2(li.amount * fraction);
    allocated = round2(allocated + amt);
    return { accountId: li.account_id, amount: amt, projectId: bill.project_id ?? undefined };
  });
  const drift = round2(params.amount - allocated);
  if (drift !== 0) splits[splits.length - 1].amount = round2(splits[splits.length - 1].amount + drift);

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({
      entity_id: params.entityId,
      money_account_id: params.moneyAccountId,
      date: params.paidDate,
      payee_name: `${bill.bill_number} — ${bill.vendor_name}`,
      amount: -params.amount,
      status: "categorized",
      is_split: splits.length > 1,
    })
    .select("id")
    .single();
  if (txnError || !txn) return { error: txnError?.message ?? "Failed to record payment transaction" };

  const posted = await postJournalEntry(supabase, {
    entityId: params.entityId,
    entryDate: params.paidDate,
    description: `Payment for ${bill.bill_number}`,
    sourceType: "manual",
    sourceTransactionId: txn.id,
    createdBy: user.id,
    lines: buildJournalLines(params.moneyAccountId, -params.amount, splits),
  });
  if ("error" in posted) {
    await supabase.from("transactions").delete().eq("id", txn.id);
    return { error: posted.error };
  }

  const { error: splitsError } = await supabase.from("transaction_splits").insert(
    splits.map((s) => ({ transaction_id: txn.id, chart_account_id: s.accountId, project_id: s.projectId ?? null, amount: s.amount }))
  );
  if (splitsError) return { error: splitsError.message };
  await supabase.from("transactions").update({ journal_entry_id: posted.journalEntryId }).eq("id", txn.id);

  const { error: paymentError } = await supabase.from("bill_payments").insert({
    bill_id: params.billId,
    amount: params.amount,
    paid_date: params.paidDate,
    method: params.method?.trim() || null,
    matched_transaction_id: txn.id,
    journal_entry_id: posted.journalEntryId,
  });
  if (paymentError) return { error: paymentError.message };

  const { data: payments } = await supabase.from("bill_payments").select("amount").eq("bill_id", params.billId);
  const totalPaid = round2((payments ?? []).reduce((sum, p) => sum + p.amount, 0));
  const newStatus = totalPaid >= bill.total ? "paid" : "partial";
  await supabase.from("bills").update({ status: newStatus }).eq("id", params.billId);

  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: user.id,
    action: "bill.payment_recorded",
    targetTable: "bills",
    targetId: params.billId,
    diff: { amount: params.amount, paidDate: params.paidDate, newStatus },
  });

  revalidatePath("/finances");
  return { success: true, status: newStatus };
}
