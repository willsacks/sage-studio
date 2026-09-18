import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEnrolledCoursesForUser } from "@/lib/queries/courses";
import { linkPendingEnrollmentsForCurrentUser } from "@/lib/actions/enrollments";

export const metadata: Metadata = { title: "My Courses" };

export default async function MyCoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await linkPendingEnrollmentsForCurrentUser();
  const courses = await getEnrolledCoursesForUser(user.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap size={22} /> My Courses
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">Courses you've been enrolled in.</p>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 border-2 border-dashed border-[var(--border)] rounded-xl">
          <GraduationCap size={32} className="text-[var(--muted-foreground)] opacity-30" />
          <p className="font-medium text-[var(--foreground)]">No courses yet</p>
          <p className="text-sm text-[var(--muted-foreground)]">Once an instructor enrolls you, your courses will show up here.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/my-courses/${course.id}`}
              className="block rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--primary)]/50 transition-colors"
            >
              <div className="aspect-[2/1] bg-[var(--muted)]/30 flex items-center justify-center">
                {course.cover_image_url ? (
                  <img src={course.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <GraduationCap size={28} className="text-[var(--muted-foreground)] opacity-30" />
                )}
              </div>
              <div className="p-4">
                <h2 className="font-medium">{course.title}</h2>
                {course.description && <p className="text-sm text-[var(--muted-foreground)] mt-1 line-clamp-2">{course.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
