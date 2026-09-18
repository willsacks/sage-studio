"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

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
