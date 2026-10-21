import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";

function slugify(title: string): string {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "course"}-${suffix}`;
}

export const coursesCreate = defineOperation({
  id: "courses.create",
  tool: "courses_create",
  module: "courses",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/courses" },
  title: "Create a course",
  description: "Creates a new draft course. Setting priceCents here is just metadata for a future paid enrollment — it never charges anyone by itself.",
  input: z.object({ title: z.string().min(1).max(300), priceCents: z.number().int().min(0).optional() }),
  output: z.object({ id: z.string(), title: z.string(), slug: z.string(), status: z.literal("draft") }),
  handler: async (ctx, input) => {
    const trimmed = input.title.trim() || "Untitled course";
    const { rows } = await ctx.db.query(
      `insert into public.courses (owner_id, title, slug, status, price_cents)
       values ($1, $2, $3, 'draft', $4)
       returning id, title, slug, status`,
      [ctx.principal.userId, trimmed, slugify(trimmed), input.priceCents ?? null]
    );
    return rows[0];
  },
});

export const coursesAddEnrollment = defineOperation({
  id: "courses.addEnrollment",
  tool: "courses_add_enrollment",
  module: "courses",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/courses/:courseId/enrollments" },
  title: "Enroll a student for free",
  description: "Adds a free (comp) enrollment by email to a course you own — no invoice or charge is ever created by this tool. For a paid enrollment, use the Students tab in the app, which also handles billing.",
  input: z.object({ courseId: z.string(), email: z.string().email() }),
  output: z.object({ id: z.string(), email: z.string(), status: z.enum(["pending", "accepted"]) }),
  handler: async (ctx, input) => {
    const { rows: courseRows } = await ctx.db.query(`select 1 from public.courses where id = $1 and owner_id = $2`, [input.courseId, ctx.principal.userId]);
    if (courseRows.length === 0) throw new Error("not_found");

    const trimmedEmail = input.email.trim().toLowerCase();
    const { rows } = await ctx.db.query(
      `insert into public.enrollments (course_id, email, status, source, price_paid_cents)
       values ($1, $2, 'pending', 'manual', 0)
       returning id, email, status`,
      [input.courseId, trimmedEmail]
    ).catch((err: unknown) => {
      if (err instanceof Error && /duplicate key/i.test(err.message)) throw new Error("duplicate");
      throw err;
    });
    return rows[0];
  },
});

export const coursesWriteOperations = [coursesCreate, coursesAddEnrollment];
