import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";
import { Page } from "@/lib/server/contract/common";

const courseSummary = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(["draft", "published"]),
  price_cents: z.number().nullable(),
});

export const coursesList = defineOperation({
  id: "courses.list",
  tool: "courses_list",
  module: "courses",
  minScope: "read",
  http: { method: "GET", path: "/courses" },
  title: "List courses",
  description: "List the courses the user owns.",
  input: z.object({}),
  output: Page(courseSummary),
  handler: async (ctx) => {
    const { rows } = await ctx.db.query(
      `select id, title, slug, status, price_cents from public.courses where owner_id = $1 order by title asc`,
      [ctx.principal.userId]
    );
    return { items: rows, next_cursor: null };
  },
});

export const coursesGetEnrollmentSummary = defineOperation({
  id: "courses.getEnrollmentSummary",
  tool: "courses_get_enrollment_summary",
  module: "courses",
  minScope: "read",
  http: { method: "GET", path: "/courses/:courseId/enrollment-summary" },
  title: "Get a course's enrollment summary",
  description: "Get enrollment counts (total, accepted, pending, by source) for one of the user's courses.",
  input: z.object({ courseId: z.string() }),
  output: z.object({
    courseId: z.string(),
    totalEnrollments: z.number(),
    acceptedCount: z.number(),
    pendingCount: z.number(),
    stripeCount: z.number(),
    manualCount: z.number(),
  }),
  handler: async (ctx, input) => {
    const { rows: courseRows } = await ctx.db.query(`select 1 from public.courses where id = $1 and owner_id = $2`, [input.courseId, ctx.principal.userId]);
    if (courseRows.length === 0) throw new Error("not_found");

    const { rows } = await ctx.db.query(
      `select count(*) as total,
              count(*) filter (where status = 'accepted') as accepted,
              count(*) filter (where status = 'pending') as pending,
              count(*) filter (where source = 'stripe') as stripe,
              count(*) filter (where source = 'manual') as manual
       from public.enrollments where course_id = $1`,
      [input.courseId]
    );
    const r = rows[0];
    return {
      courseId: input.courseId,
      totalEnrollments: Number(r.total),
      acceptedCount: Number(r.accepted),
      pendingCount: Number(r.pending),
      stripeCount: Number(r.stripe),
      manualCount: Number(r.manual),
    };
  },
});

export const coursesOperations = [coursesList, coursesGetEnrollmentSummary];
