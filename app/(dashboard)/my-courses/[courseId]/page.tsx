import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourseById, getCourseContent } from "@/lib/queries/courses";
import { StudentCourseView } from "@/components/courses/StudentCourseView";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourseById(courseId);
  return { title: course?.title ?? "Course" };
}

export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS on both tables only returns rows for the course owner or an
  // accepted-enrollment student — a not-actually-enrolled visitor simply
  // gets a null course here, which reads as a clean 404 rather than a
  // raw 403/500 (see the plan's own verification note on this exact case).
  const course = await getCourseById(courseId);
  if (!course) notFound();
  const modules = await getCourseContent(courseId);

  return <StudentCourseView course={course} modules={modules} />;
}
