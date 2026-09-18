import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";

export type Course = Tables<"courses">;
export type CourseModule = Tables<"course_modules">;
export type Lesson = Tables<"lessons">;
export type Enrollment = Tables<"enrollments">;

export async function getCoursesForOwner(ownerId: string): Promise<Course[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCourseById(id: string): Promise<Course | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("*").eq("id", id).single();
  return data;
}

export interface ModuleWithLessons extends CourseModule {
  lessons: Lesson[];
}

/** Fetches a course's full module/lesson tree in two queries (not N+1) —
 * modules and lessons come back flat and are grouped in memory, mirroring
 * how PagesManager groups pages by parent rather than querying per-row. */
export async function getCourseContent(courseId: string): Promise<ModuleWithLessons[]> {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  if (!modules || modules.length === 0) return [];

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .in("module_id", modules.map((m) => m.id))
    .order("sort_order", { ascending: true });

  return modules.map((m) => ({
    ...m,
    lessons: (lessons ?? []).filter((l) => l.module_id === m.id),
  }));
}

export async function getEnrollmentsForCourse(courseId: string): Promise<Enrollment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("*")
    .eq("course_id", courseId)
    .order("enrolled_at", { ascending: false });
  return data ?? [];
}

export type LessonProgress = Tables<"lesson_progress">;

/** This user's own progress rows for a course, keyed by lesson id — relies
 * on the same RLS as everything else here (a student can only ever select
 * their own lesson_progress rows), so no explicit enrollment/user filter
 * is needed beyond what the query already implies. */
export async function getMyProgressForCourse(courseId: string, userId: string): Promise<Map<string, LessonProgress>> {
  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .single();
  if (!enrollment) return new Map();

  const { data } = await supabase.from("lesson_progress").select("*").eq("enrollment_id", enrollment.id);
  return new Map((data ?? []).map((p) => [p.lesson_id, p]));
}

export interface MyCourseProgress {
  completedCount: number;
  totalLessons: number;
  firstIncompleteLessonId: string | null;
}

/** Backs the progress bar + "Continue" deep link on My Courses — computed
 * per course rather than joined across all enrollments at once, since a
 * student's own course list is small (their own enrollments, not every
 * student on the platform). */
export async function getMyCourseProgress(courseId: string, userId: string): Promise<MyCourseProgress> {
  const [modules, progressMap] = await Promise.all([getCourseContent(courseId), getMyProgressForCourse(courseId, userId)]);
  const lessons = modules.flatMap((m) => m.lessons);
  const completedCount = lessons.filter((l) => progressMap.get(l.id)?.completed_at).length;
  const firstIncomplete = lessons.find((l) => !progressMap.get(l.id)?.completed_at);
  return { completedCount, totalLessons: lessons.length, firstIncompleteLessonId: firstIncomplete?.id ?? null };
}

export interface StudentProgressRow {
  enrollmentId: string;
  email: string;
  status: "pending" | "accepted";
  completedCount: number;
  totalLessons: number;
}

/** Per-student completion summary for a course's instructor-facing
 * Students page — one query for enrollments/progress, counted in memory
 * against the lesson count rather than N+1 per student. */
export async function getStudentProgressForCourse(courseId: string): Promise<StudentProgressRow[]> {
  const supabase = await createClient();
  const [{ data: enrollments }, modules] = await Promise.all([
    supabase.from("enrollments").select("id, email, status").eq("course_id", courseId),
    getCourseContent(courseId),
  ]);
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  if (!enrollments || enrollments.length === 0) return [];

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("enrollment_id, completed_at")
    .in("enrollment_id", enrollments.map((e) => e.id))
    .not("completed_at", "is", null);

  const completedByEnrollment = new Map<string, number>();
  for (const p of progress ?? []) {
    completedByEnrollment.set(p.enrollment_id, (completedByEnrollment.get(p.enrollment_id) ?? 0) + 1);
  }

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    email: e.email,
    status: e.status,
    completedCount: completedByEnrollment.get(e.id) ?? 0,
    totalLessons,
  }));
}

/** Courses the given user is an accepted student of — relies on the same
 * RLS ("Enrolled students view their course") that also gates the join
 * target, so this naturally returns nothing for courses access was since
 * revoked from, without any extra filtering here. */
export async function getEnrolledCoursesForUser(userId: string): Promise<Course[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("courses(*)")
    .eq("user_id", userId)
    .eq("status", "accepted");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => r.courses).filter(Boolean) as Course[];
}
