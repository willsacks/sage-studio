import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourseById, getCourseContent } from "@/lib/queries/courses";
import { CourseEditor } from "@/components/courses/CourseEditor";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourseById(courseId);
  return { title: course?.title ?? "Course" };
}

export default async function CourseEditPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const course = await getCourseById(courseId);
  if (!course) notFound();
  if (course.owner_id !== user.id) redirect("/courses");

  const modules = await getCourseContent(courseId);

  return <CourseEditor course={course} modules={modules} />;
}
