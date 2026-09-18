import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCoursesForOwner } from "@/lib/queries/courses";
import { NewCourseButton } from "@/components/courses/NewCourseButton";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const courses = await getCoursesForOwner(user.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap size={22} /> Courses
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1 text-sm">
            Build courses, organize lessons into modules, and manage enrolled students.
          </p>
        </div>
        <NewCourseButton />
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 border-2 border-dashed border-[var(--border)] rounded-xl">
          <GraduationCap size={32} className="text-[var(--muted-foreground)] opacity-30" />
          <div className="text-center">
            <p className="font-medium text-[var(--foreground)]">No courses yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Create your first course to start adding modules and lessons.</p>
          </div>
          <NewCourseButton />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="block rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--primary)]/50 transition-colors"
            >
              <div className="aspect-[2/1] bg-[var(--muted)]/30 flex items-center justify-center">
                {course.cover_image_url ? (
                  <img src={course.cover_image_url} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${course.cover_image_focus_x ?? 50}% ${course.cover_image_focus_y ?? 50}%` }} />
                ) : (
                  <GraduationCap size={28} className="text-[var(--muted-foreground)] opacity-30" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{course.title}</h2>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${
                      course.status === "published" ? "bg-green-500/15 text-green-600" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {course.status}
                  </span>
                </div>
                {course.description && <p className="text-sm text-[var(--muted-foreground)] mt-1 line-clamp-2">{course.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
