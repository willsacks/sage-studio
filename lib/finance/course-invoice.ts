import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";
import { logFinanceAudit } from "@/lib/finance/audit";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Records a Stripe-paid course enrollment as an already-paid invoice in
 * the creator's Finance books — same shape lib/actions/finance-invoices.ts's
 * `createInvoice` writes, duplicated rather than reused because that
 * function is a cookie-coupled Server Action (`requireAuth()` reads the
 * current request's session) and this runs from a webhook with no user
 * session at all. Posted straight to "paid" (skipping draft/sent) since
 * Stripe already collected the money — mirrors
 * lib/actions/enrollments.ts's `enrollStudentByEmail`, which does the
 * same draft→sent promotion for a manually-invited student, just one
 * status further along because this one's actually been paid.
 */
export async function postPaidCourseInvoice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  params: { entityId: string; actorId: string; courseTitle: string; clientEmail: string; amountCents: number; issueDate: string }
): Promise<{ invoiceId: string } | { error: string }> {
  const total = round2(params.amountCents / 100);

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", params.entityId);
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      entity_id: params.entityId,
      client_name: params.clientEmail,
      client_email: params.clientEmail,
      invoice_number: invoiceNumber,
      issue_date: params.issueDate,
      status: "paid",
      subtotal: total,
      tax_amount: 0,
      total,
      notes: `Course enrollment (paid via Stripe): ${params.courseTitle}`,
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) return { error: invoiceError?.message ?? "Failed to create invoice" };

  const { error: lineItemError } = await supabase.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    description: `Course: ${params.courseTitle}`,
    quantity: 1,
    unit_price: total,
    amount: total,
    display_order: 0,
  });
  if (lineItemError) return { error: lineItemError.message };

  await logFinanceAudit(supabase, {
    entityId: params.entityId,
    actorId: params.actorId,
    action: "invoice.paid",
    targetTable: "invoices",
    targetId: invoice.id as string,
    diff: { clientEmail: params.clientEmail, total, courseTitle: params.courseTitle },
  });

  return { invoiceId: invoice.id as string };
}
