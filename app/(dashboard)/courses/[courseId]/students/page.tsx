import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourseById, getEnrollmentsForCourse } from "@/lib/queries/courses";
import { EnrollmentsManager } from "@/components/courses/EnrollmentsManager";

export const metadata: Metadata = { title: "Students" };

export default async function CourseStudentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const course = await getCourseById(courseId);
  if (!course) notFound();
  if (course.owner_id !== user.id) redirect("/courses");

  const enrollments = await getEnrollmentsForCourse(courseId);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link href={`/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft size={14} /> {course.title}
      </Link>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users size={22} /> Students
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Enroll a student by email — if they already have a Sage Studio account it takes effect immediately, otherwise it activates the next time they log in.
        </p>
      </div>
      <EnrollmentsManager courseId={courseId} enrollments={enrollments} />
    </div>
  );
}
