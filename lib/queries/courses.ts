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
