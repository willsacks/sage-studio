"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { postJournalEntry } from "@/lib/finance/ledger";
import { buildJournalLines } from "@/lib/finance/categorize";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type InvoiceLineItemInput = { description: string; quantity: number; unitPrice: number };

export async function listInvoices(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_line_items(*), invoice_payments(*)")
    .eq("entity_id", entityId)
    .order("issue_date", { ascending: false });
  if (error) return { error: error.message, invoices: [] };
  return { invoices: data ?? [] };
}

export async function createInvoice(params: {
  entityId: string;
  projectId?: string;
  clientName: string;
  clientEmail?: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  taxAmount?: number;
  lineItems: InvoiceLineItemInput[];
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  if (!params.clientName.trim()) return { error: "A client name is required" };
  if (params.lineItems.length === 0) return { error: "Add at least one line item" };

  const subtotal = round2(params.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0));
  const taxAmount = round2(params.taxAmount ?? 0);
  const total = round2(subtotal + taxAmount);

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", params.entityId);
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      entity_id: params.entityId,
      project_id: params.projectId ?? null,
      client_name: params.clientName.trim(),
      client_email: params.clientEmail?.trim() || null,
      invoice_number: invoiceNumber,
      issue_date: params.issueDate,
      due_date: params.dueDate || null,
      status: "draft",
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: params.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) return { error: invoiceError?.message ?? "Failed to create invoice" };

  const { error: lineItemsError } = await supabase.from("invoice_line_items").insert(
    params.lineItems.map((li, i) => ({
      invoice_id: invoice.id,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unitPrice,
      amount: round2(li.quantity * li.unitPrice),
      display_order: i,
    }))
  );
  if (lineItemsError) return { error: lineItemsError.message };

  revalidatePath("/finances");
  return { invoiceId: invoice.id as string };
}

export async function setInvoiceStatus(invoiceId: string, entityId: string, status: "sent" | "void") {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

/** Recording a payment is what actually touches the ledger — invoices
 * themselves are a lightweight tracking layer (draft/sent/paid status),
 * not a full accrual-accounting Accounts Receivable posting. This keeps
 * the mental model matching how a solo creative actually thinks about
 * getting paid, while still producing a real, balanced journal entry
 * tagged to the invoice's project for profitability reporting. */
export async function recordInvoicePayment(params: {
  invoiceId: string;
  entityId: string;
  amount: number;
  paidDate: string;
  moneyAccountId: string;
  incomeAccountId: string;
  method?: string;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, project_id, client_name, invoice_number, total")
    .eq("id", params.invoiceId)
    .eq("entity_id", params.entityId)
    .single();
  if (invoiceError || !invoice) return { error: invoiceError?.message ?? "Invoice not found" };

  if (params.amount <= 0) return { error: "Payment amount must be positive" };

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert({
      entity_id: params.entityId,
      date: params.paidDate,
      payee_name: `${invoice.invoice_number} — ${invoice.client_name}`,
      amount: params.amount,
      status: "categorized",
    })
    .select("id")
    .single();
  if (txnError || !txn) return { error: txnError?.message ?? "Failed to record payment transaction" };

  const posted = await postJournalEntry(supabase, {
    entityId: params.entityId,
    entryDate: params.paidDate,
    description: `Payment for ${invoice.invoice_number}`,
    sourceType: "invoice_payment",
    sourceTransactionId: txn.id,
    createdBy: user.id,
    lines: buildJournalLines(params.moneyAccountId, params.amount, [{ accountId: params.incomeAccountId, amount: params.amount, projectId: invoice.project_id ?? undefined }]),
  });
  if ("error" in posted) {
    await supabase.from("transactions").delete().eq("id", txn.id);
    return { error: posted.error };
  }

  await supabase.from("transaction_splits").insert({
    transaction_id: txn.id,
    chart_account_id: params.incomeAccountId,
    project_id: invoice.project_id,
    amount: params.amount,
  });
  await supabase.from("transactions").update({ journal_entry_id: posted.journalEntryId }).eq("id", txn.id);

  const { error: paymentError } = await supabase.from("invoice_payments").insert({
    invoice_id: params.invoiceId,
    amount: params.amount,
    paid_date: params.paidDate,
    method: params.method?.trim() || null,
    matched_transaction_id: txn.id,
    journal_entry_id: posted.journalEntryId,
  });
  if (paymentError) return { error: paymentError.message };

  const { data: payments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", params.invoiceId);
  const totalPaid = round2((payments ?? []).reduce((sum, p) => sum + p.amount, 0));
  const newStatus = totalPaid >= invoice.total ? "paid" : "partial";
  await supabase.from("invoices").update({ status: newStatus }).eq("id", params.invoiceId);

  revalidatePath("/finances");
  return { success: true, status: newStatus };
}
