"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Resolves (or is refused) the caller's own accepted enrollment for the
 * course a lesson belongs to — every progress write goes through this so
 * a student can only ever touch their own progress rows, never another
 * student's, regardless of what lesson/enrollment id is passed in. */
async function requireOwnEnrollmentForLesson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  lessonId: string
): Promise<string> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("module_id, course_modules!inner(course_id)")
    .eq("id", lessonId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courseId = (lesson as any)?.course_modules?.course_id;
  if (!courseId) throw new Error("Lesson not found");

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .single();
  if (!enrollment) throw new Error("Not enrolled");
  return enrollment.id;
}

export async function toggleLessonComplete(lessonId: string, completed: boolean) {
  const { supabase, user } = await requireAuth();
  const enrollmentId = await requireOwnEnrollmentForLesson(supabase, user.id, lessonId);

  const { error } = await supabase
    .from("lesson_progress")
    .upsert(
      { enrollment_id: enrollmentId, lesson_id: lessonId, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: "enrollment_id,lesson_id" }
    );
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateLessonVideoPosition(lessonId: string, seconds: number) {
  const { supabase, user } = await requireAuth();
  const enrollmentId = await requireOwnEnrollmentForLesson(supabase, user.id, lessonId);

  const { error } = await supabase
    .from("lesson_progress")
    .upsert(
      { enrollment_id: enrollmentId, lesson_id: lessonId, last_position_seconds: Math.floor(seconds), updated_at: new Date().toISOString() },
      { onConflict: "enrollment_id,lesson_id", ignoreDuplicates: false }
    );
  if (error) return { error: error.message };
  return { success: true };
}

/** Issues a short-lived signed URL for a lesson's video. Authorization is
 * the plain cookie-bound select itself: the lessons table's RLS only
 * returns a row here if the caller owns the course or has an accepted
 * enrollment in it (see scripts/add-lms-schema.ts), so no separate
 * enrollment check is needed — if the row comes back, they're allowed to
 * see it. The admin client is only used for the storage signing step,
 * never to read the lesson row itself. */
export async function getStudentLessonVideoUrl(lessonId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: lesson } = await supabase.from("lessons").select("video_path").eq("id", lessonId).single();
  if (!lesson?.video_path) return { error: "Video not found" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("course-videos").createSignedUrl(lesson.video_path, 3600);
  if (error || !data) return { error: error?.message ?? "Could not load video" };
  return { url: data.signedUrl };
}
