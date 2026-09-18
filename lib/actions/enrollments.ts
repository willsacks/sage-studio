"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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
 * which keeps this action simple and handles both cases identically. */
export async function enrollStudentByEmail(courseId: string, email: string) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email address" };

  const { error } = await supabase.from("enrollments").insert({
    course_id: courseId,
    email: trimmed,
    status: "pending",
    source: "manual",
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
