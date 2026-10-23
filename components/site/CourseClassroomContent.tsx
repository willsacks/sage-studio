import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCourseById, getCourseContent, getMyProgressForCourse } from "@/lib/queries/courses";
import { StudentCourseView } from "@/components/courses/StudentCourseView";
import { CourseEnrollBlock } from "@/components/offer-builder/blocks/CourseEnrollBlock";

/**
 * The page_type: "course_classroom" branch of a site page — renders the
 * same StudentCourseView the dashboard's /my-courses/[courseId] page
 * already uses (unchanged), reached instead from the course's own
 * branded site/domain. Not RLS-visible to a logged-out or non-enrolled
 * visitor (courses.courses has no public-select policy — only an owner
 * or an accepted enrollment can read the row, scripts/add-lms-schema.ts),
 * so this falls back to an enroll CTA whenever getCourseById comes back
 * null, exactly mirroring what RLS already means on /my-courses: "you
 * can't see this course's content."
 */
export async function CourseClassroomContent({ courseId }: { courseId: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const course = await getCourseById(courseId);
    if (course) {
      const [modules, progress] = await Promise.all([
        getCourseContent(courseId),
        getMyProgressForCourse(courseId, user.id),
      ]);
      return (
        <StudentCourseView
          course={course}
          modules={modules}
          initialProgress={Object.fromEntries(progress)}
        />
      );
    }
  }

  // Not logged in, or logged in but not enrolled/owner — course title and
  // price are read via the admin client here (same pattern as
  // app/api/course-checkout/route.ts) since RLS has no public-select
  // policy on `courses`, but this is only ever marketing info (title,
  // price), scoped to a courseId the site owner themselves configured on
  // this page, not arbitrary user input.
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: course } = await (admin as any)
    .from("courses")
    .select("title, description, price_cents, status")
    .eq("id", courseId)
    .single();
  if (!course || course.status !== "published") {
    return <div className="max-w-xl mx-auto px-6 py-24 text-center text-sm opacity-70">This course isn&apos;t available right now.</div>;
  }

  return (
    <CourseEnrollBlock
      data={{
        courseId,
        courseTitle: course.title,
        priceCents: course.price_cents,
        description: course.description ?? "Enroll to get full access to the course material.",
        buttonText: "Enroll Now",
      }}
    />
  );
}
