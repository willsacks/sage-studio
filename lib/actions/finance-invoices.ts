"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { postJournalEntry } from "@/lib/finance/ledger";
import { buildJournalLines } from "@/lib/finance/categorize";
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

  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: user.id,
    action: "invoice.created",
    targetTable: "invoices",
    targetId: invoice.id as string,
    diff: { clientName: params.clientName.trim(), total, lineItems: params.lineItems },
  });

  revalidatePath("/finances");
  return { invoiceId: invoice.id as string };
}

export async function setInvoiceStatus(invoiceId: string, entityId: string, status: "sent" | "void") {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId).eq("entity_id", entityId);
  if (error) return { error: error.message };

  // When voiding, release any time entries billed on this invoice
  if (status === "void") {
    await supabase.from("time_entries").update({ invoice_id: null }).eq("invoice_id", invoiceId);
  }

  await logFinanceAudit(supabase, { entityId, actorId: user.id, action: status === "void" ? "invoice.voided" : "invoice.sent", targetTable: "invoices", targetId: invoiceId });
  revalidatePath("/finances");
  revalidatePath("/tasks");
  return { success: true };
}

export async function createInvoiceFromTimeEntries(params: {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  entityId: string;
  hourlyRate: number;
  issueDate: string;
  dueDate?: string;
  lineStyle: "summary" | "by_day";
  from?: string;
  to?: string;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  if (params.hourlyRate <= 0) return { error: "Hourly rate must be greater than 0" };

  // Fetch unbilled entries for this client in range
  let query = supabase
    .from("time_entries")
    .select("id, description, started_at, stopped_at, duration_seconds, category")
    .eq("client_id", params.clientId)
    .eq("user_id", user.id)
    .not("stopped_at", "is", null)
    .is("invoice_id", null)
    .order("started_at", { ascending: true });

  if (params.from) query = query.gte("started_at", `${params.from}T00:00:00`);
  if (params.to)   query = query.lte("started_at", `${params.to}T23:59:59`);

  const { data: entries, error: fetchError } = await query;
  if (fetchError) return { error: fetchError.message };
  if (!entries || entries.length === 0) return { error: "No unbilled time entries found in this range" };

  function entrySeconds(e: { duration_seconds: number | null; started_at: string; stopped_at: string }) {
    if (e.duration_seconds != null && e.duration_seconds > 0) return e.duration_seconds;
    return Math.max(0, Math.floor((new Date(e.stopped_at).getTime() - new Date(e.started_at).getTime()) / 1000));
  }

  let lineItems: { description: string; quantity: number; unitPrice: number }[];

  if (params.lineStyle === "by_day") {
    // Group by calendar day
    const dayMap = new Map<string, number>();
    for (const e of entries) {
      const day = e.started_at.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + entrySeconds(e));
    }
    lineItems = Array.from(dayMap.entries()).map(([day, secs]) => {
      const hrs = round2(secs / 3600);
      const d = new Date(day);
      const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      return { description: `Design work — ${label}`, quantity: hrs, unitPrice: params.hourlyRate };
    });
  } else {
    // Single summary line
    const totalSecs = entries.reduce((s, e) => s + entrySeconds(e), 0);
    const totalHrs = round2(totalSecs / 3600);
    const rangeLabel = params.from && params.to
      ? `${params.from} – ${params.to}`
      : params.from ? `from ${params.from}` : params.to ? `through ${params.to}` : "all time";
    lineItems = [{ description: `${params.clientName} — work (${rangeLabel})`, quantity: totalHrs, unitPrice: params.hourlyRate }];
  }

  const subtotal = round2(lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0));
  const total = subtotal;

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", params.entityId);
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      entity_id: params.entityId,
      client_name: params.clientName.trim(),
      client_email: params.clientEmail?.trim() || null,
      invoice_number: invoiceNumber,
      issue_date: params.issueDate,
      due_date: params.dueDate || null,
      status: "draft",
      subtotal,
      tax_amount: 0,
      total,
      notes: null,
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) return { error: invoiceError?.message ?? "Failed to create invoice" };

  await supabase.from("invoice_line_items").insert(
    lineItems.map((li, i) => ({
      invoice_id: invoice.id,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unitPrice,
      amount: round2(li.quantity * li.unitPrice),
      display_order: i,
    }))
  );

  // Stamp all billed entries with the invoice id
  const entryIds = entries.map((e) => e.id);
  await supabase.from("time_entries").update({ invoice_id: invoice.id }).in("id", entryIds);

  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: user.id,
    action: "invoice.created",
    targetTable: "invoices",
    targetId: invoice.id as string,
    diff: { source: "time_tracker", clientId: params.clientId, entryCount: entries.length, total },
  });

  revalidatePath("/finances");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/clients/${params.clientId}`);
  return { invoiceId: invoice.id as string };
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
      money_account_id: params.moneyAccountId,
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

  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: user.id,
    action: "invoice.payment_recorded",
    targetTable: "invoices",
    targetId: params.invoiceId,
    diff: { amount: params.amount, paidDate: params.paidDate, newStatus },
  });

  revalidatePath("/finances");
  return { success: true, status: newStatus };
}
