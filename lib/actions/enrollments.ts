"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createInvoice, setInvoiceStatus } from "@/lib/actions/finance-invoices";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function requireCourseOwner(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string, userId: string) {
  const { data: course } = await supabase.from("courses").select("id, owner_id").eq("id", courseId).single();
  if (!course || course.owner_id !== userId) throw new Error("Not authorized");
}

/** Instructor invites a student by email. No account lookup happens here —
 * whether the email already has a Sage Studio account or not, the row
 * starts "pending" and gets linked/accepted the next time that person is
 * authenticated with a matching email (see linkPendingEnrollmentsForUser),
 * which keeps this action simple and handles both cases identically.
 *
 * `priceCentsOverride` lets the instructor comp a student (0) or discount
 * them (any amount below the course's list price) — omit it to charge the
 * course's normal price_cents. A priced enrollment creates a draft invoice
 * in the instructor's first Finance entity (if they have one) for the
 * real amount charged, so a discount/comp is exactly what shows up in
 * Finances, not the list price. */
export async function enrollStudentByEmail(courseId: string, email: string, priceCentsOverride?: number) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email address" };

  const { data: course } = await supabase.from("courses").select("title, price_cents").eq("id", courseId).single();
  const priceCents = priceCentsOverride !== undefined ? Math.max(0, Math.round(priceCentsOverride)) : (course?.price_cents ?? null);

  let invoiceId: string | null = null;
  if (priceCents && priceCents > 0) {
    const { data: entity } = await supabase
      .from("finance_entities")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (entity) {
      const result = await createInvoice({
        entityId: entity.id,
        clientName: trimmed,
        clientEmail: trimmed,
        issueDate: new Date().toISOString().slice(0, 10),
        notes: `Course enrollment: ${course?.title ?? "Untitled course"}`,
        lineItems: [{ description: `Course: ${course?.title ?? "Untitled course"}`, quantity: 1, unitPrice: priceCents / 100 }],
      });
      if ("invoiceId" in result && result.invoiceId) {
        invoiceId = result.invoiceId;
        // Draft invoices are easy to miss — this is a real sale that just
        // happened, so it should show up in Finances' normal "outstanding"
        // view right away, not sit hidden in drafts until someone notices.
        await setInvoiceStatus(invoiceId, entity.id, "sent");
      }
    }
    // No finance entity yet — the enrollment still records what was
    // charged; the instructor just won't see an invoice until they set
    // Finances up. Not a hard failure, since paying students shouldn't be
    // blocked on the instructor's bookkeeping setup.
  }

  const { error } = await supabase.from("enrollments").insert({
    course_id: courseId,
    email: trimmed,
    status: "pending",
    source: "manual",
    price_paid_cents: priceCents,
    invoice_id: invoiceId,
  });
  if (error) {
    if (error.code === "23505") return { error: "That email is already enrolled in this course" };
    return { error: error.message };
  }

  // Immediately accept if that email already has a Sage Studio account —
  // otherwise it stays pending until they next log in (see below).
  await linkPendingEnrollmentsForEmail(trimmed);

  revalidatePath(`/courses/${courseId}/students`);
  return { success: true };
}

export async function removeEnrollment(enrollmentId: string, courseId: string) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId).eq("course_id", courseId);
  if (error) return { error: error.message };
  revalidatePath(`/courses/${courseId}/students`);
  return { success: true };
}

/** Links any pending, unlinked enrollment rows for this email to a real
 * user id — uses the admin client since a not-yet-linked row (user_id is
 * still null) can't be matched by the "select their own enrollment" RLS
 * policy, which keys off user_id. Scoped to a single email at a time so it
 * can only ever affect rows that match a specific, already-known address. */
async function linkPendingEnrollmentsForEmail(email: string) {
  const admin = createAdminClient();
  const { data: userId } = await admin.rpc("get_user_id_by_email" as never, { p_email: email } as never) as unknown as { data: string | null };
  if (!userId) return;

  await admin
    .from("enrollments")
    .update({ user_id: userId, status: "accepted" })
    .eq("email", email)
    .is("user_id", null);
}

/** Called when an authenticated user visits their courses — links (and
 * accepts) any pending enrollment invites sent to their own verified
 * email. Self-service and self-scoped: it can only ever touch rows
 * matching the caller's own auth email, never an arbitrary address. */
export async function linkPendingEnrollmentsForCurrentUser() {
  const { user } = await requireAuth();
  if (!user.email) return { success: true };
  const admin = createAdminClient();
  await admin
    .from("enrollments")
    .update({ user_id: user.id, status: "accepted" })
    .eq("email", user.email.toLowerCase())
    .is("user_id", null);
  return { success: true };
}
