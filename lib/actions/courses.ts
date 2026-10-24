"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function slugify(title: string): string {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "course"}-${suffix}`;
}

async function requireCourseOwner(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string, userId: string) {
  const { data: course } = await supabase.from("courses").select("id, owner_id").eq("id", courseId).single();
  if (!course || course.owner_id !== userId) throw new Error("Not authorized");
  return course;
}

async function requireModuleOwner(supabase: Awaited<ReturnType<typeof createClient>>, moduleId: string, userId: string) {
  const { data: mod } = await supabase
    .from("course_modules")
    .select("id, course_id, courses!inner(owner_id)")
    .eq("id", moduleId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerId = (mod as any)?.courses?.owner_id;
  if (!mod || ownerId !== userId) throw new Error("Not authorized");
  return mod;
}

// ─── Courses ──────────────────────────────────────────────────────────

export async function addCourse(title: string) {
  const { supabase, user } = await requireAuth();
  const trimmed = title.trim() || "Untitled course";
  const { data, error } = await supabase
    .from("courses")
    .insert({ owner_id: user.id, title: trimmed, slug: slugify(trimmed), status: "draft" })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create course" };
  revalidatePath("/courses");
  return { courseId: data.id as string };
}

/** Creates a dedicated site for a course — a "home" page (the real
 * sales/marketing page, built with the normal site builder, completely
 * untouched — the creator adds a course_enroll block to it themselves)
 * plus a "learn" page with page_type "course_classroom", which the
 * public route (app/sites/[slug]/[pageSlug]/page.tsx) renders as the
 * actual course player once a visitor is logged in and enrolled. Counts
 * against the same Free-plan site limit any other site creation does
 * (lib/plan-gates.ts's canCreateSite) — this isn't a way around it. */
export async function createSiteForCourse(courseId: string) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);

  const { data: fullCourse } = await supabase.from("courses").select("title, site_id").eq("id", courseId).single();
  if (fullCourse?.site_id) return { error: "This course already has a site" };

  const { count: siteCount } = await supabase
    .from("artist_sites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { data: profile } = await supabase.from("profiles").select("tier_key, role").eq("id", user.id).single();
  const { isProPlan, canCreateSite } = await import("@/lib/plan-gates");
  const plan = isProPlan(profile?.tier_key ?? "", profile?.role) ? ("pro" as const) : ("free" as const);
  if (!canCreateSite(plan, siteCount ?? 0)) return { error: "Upgrade to Pro to create more than 1 site" };

  const title = fullCourse?.title ?? "Course";
  const { data: site, error: siteError } = await supabase
    .from("artist_sites")
    .insert({ user_id: user.id, name: title, slug: slugify(title) })
    .select("id, slug")
    .single();
  if (siteError || !site) return { error: siteError?.message ?? "Failed to create site" };

  // Supabase's batch insert builds one statement whose column set is the
  // union of every row's keys — a row that simply omits a column still
  // gets an explicit NULL for it rather than falling back to the DB
  // default, so requires_course_enrollment/gate_course_id must be given
  // real values on BOTH rows, not left out of the "home" row.
  const { error: pagesError } = await supabase.from("site_pages").insert([
    { user_id: user.id, site_id: site.id, title, slug: "home", page_type: "home", sort_order: 0, requires_course_enrollment: false, gate_course_id: null },
    {
      user_id: user.id,
      site_id: site.id,
      title: "Classroom",
      slug: "learn",
      page_type: "course_classroom",
      sort_order: 1,
      requires_course_enrollment: true,
      gate_course_id: courseId,
    } as never,
  ]);
  if (pagesError) {
    await supabase.from("artist_sites").delete().eq("id", site.id);
    return { error: pagesError.message };
  }

  await supabase.from("courses").update({ site_id: site.id }).eq("id", courseId);

  revalidatePath(`/courses/${courseId}`);
  return { siteId: site.id as string, siteSlug: site.slug as string };
}

export async function saveCourse(
  courseId: string,
  data: {
    title?: string;
    slug?: string;
    description?: string;
    coverImageUrl?: string | null;
    coverImageFocusX?: number;
    coverImageFocusY?: number;
    priceCents?: number | null;
  }
) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const { error } = await supabase
    .from("courses")
    .update({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.coverImageUrl !== undefined ? { cover_image_url: data.coverImageUrl } : {}),
      ...(data.coverImageFocusX !== undefined ? { cover_image_focus_x: data.coverImageFocusX } : {}),
      ...(data.coverImageFocusY !== undefined ? { cover_image_focus_y: data.coverImageFocusY } : {}),
      ...(data.priceCents !== undefined ? { price_cents: data.priceCents } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);
  if (error) return { error: error.message };
  revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

export async function toggleCoursePublished(courseId: string, publish: boolean) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const { error } = await supabase
    .from("courses")
    .update({ status: publish ? "published" : "draft" })
    .eq("id", courseId);
  if (error) return { error: error.message };
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

export async function deleteCourse(courseId: string) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return { error: error.message };
  revalidatePath("/courses");
  return { success: true };
}

// ─── Modules ──────────────────────────────────────────────────────────

export async function addModule(courseId: string, title: string) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const { count } = await supabase
    .from("course_modules")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  const { data, error } = await supabase
    .from("course_modules")
    .insert({ course_id: courseId, title: title.trim() || "Untitled module", sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create module" };
  revalidatePath(`/courses/${courseId}`);
  return { moduleId: data.id as string };
}

export async function renameModule(moduleId: string, title: string) {
  const { supabase, user } = await requireAuth();
  const mod = await requireModuleOwner(supabase, moduleId, user.id);
  const { error } = await supabase.from("course_modules").update({ title: title.trim() || "Untitled module" }).eq("id", moduleId);
  if (error) return { error: error.message };
  revalidatePath(`/courses/${mod.course_id}`);
  return { success: true };
}

export async function deleteModule(moduleId: string) {
  const { supabase, user } = await requireAuth();
  const mod = await requireModuleOwner(supabase, moduleId, user.id);
  const { error } = await supabase.from("course_modules").delete().eq("id", moduleId);
  if (error) return { error: error.message };
  revalidatePath(`/courses/${mod.course_id}`);
  return { success: true };
}

/** Swaps sort_order with the adjacent module in `direction` — a simple
 * up/down move rather than full drag-and-drop, since a course's module
 * count is small (this mirrors the "posts sort chronologically, no dnd"
 * simplicity call made for site_posts rather than pulling in dnd-kit here). */
export async function moveModule(courseId: string, moduleId: string, direction: "up" | "down") {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const { data: modules } = await supabase
    .from("course_modules")
    .select("id, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  if (!modules) return { error: "Not found" };
  const index = modules.findIndex((m) => m.id === moduleId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= modules.length) return { success: true };
  const a = modules[index];
  const b = modules[swapIndex];
  await Promise.all([
    supabase.from("course_modules").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("course_modules").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

// ─── Lessons ──────────────────────────────────────────────────────────

export async function addLesson(moduleId: string, title: string) {
  const { supabase, user } = await requireAuth();
  const mod = await requireModuleOwner(supabase, moduleId, user.id);
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);
  const { data, error } = await supabase
    .from("lessons")
    .insert({ module_id: moduleId, title: title.trim() || "Untitled lesson", sort_order: count ?? 0, content_type: "text" })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create lesson" };
  revalidatePath(`/courses/${mod.course_id}`);
  return { lessonId: data.id as string };
}

async function requireLessonOwner(supabase: Awaited<ReturnType<typeof createClient>>, lessonId: string, userId: string) {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, module_id, course_modules!inner(course_id, courses!inner(owner_id))")
    .eq("id", lessonId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = lesson as any;
  const ownerId = l?.course_modules?.courses?.owner_id;
  const courseId = l?.course_modules?.course_id;
  if (!lesson || ownerId !== userId) throw new Error("Not authorized");
  return { lessonId, courseId: courseId as string };
}

export async function saveLesson(
  lessonId: string,
  data: { title?: string; contentType?: "text" | "video"; body?: string | null; videoPath?: string | null }
) {
  const { supabase, user } = await requireAuth();
  const { courseId } = await requireLessonOwner(supabase, lessonId, user.id);
  const { error } = await supabase
    .from("lessons")
    .update({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.contentType !== undefined ? { content_type: data.contentType } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.videoPath !== undefined ? { video_path: data.videoPath } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (error) return { error: error.message };
  revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

export async function deleteLesson(lessonId: string) {
  const { supabase, user } = await requireAuth();
  const { courseId } = await requireLessonOwner(supabase, lessonId, user.id);
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return { error: error.message };
  revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

export async function moveLesson(moduleId: string, lessonId: string, direction: "up" | "down") {
  const { supabase, user } = await requireAuth();
  const mod = await requireModuleOwner(supabase, moduleId, user.id);
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, sort_order")
    .eq("module_id", moduleId)
    .order("sort_order", { ascending: true });
  if (!lessons) return { error: "Not found" };
  const index = lessons.findIndex((l) => l.id === lessonId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= lessons.length) return { success: true };
  const a = lessons[index];
  const b = lessons[swapIndex];
  await Promise.all([
    supabase.from("lessons").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("lessons").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  revalidatePath(`/courses/${mod.course_id}`);
  return { success: true };
}

// ─── Video upload/preview ─────────────────────────────────────────────

/** Mints a signed upload URL for a lesson video — the browser uploads
 * directly to Supabase Storage with this (never through our own server),
 * which both avoids Vercel's ~4.5MB serverless request body ceiling and
 * means the private course-videos bucket needs no client-facing storage
 * RLS policy: the signed token itself is the access grant. */
export async function createCourseVideoUploadUrl(courseId: string, fileName: string) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const ext = fileName.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${courseId}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("course-videos").createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not prepare upload" };
  return { path, token: data.token };
}

/** Short-lived signed read URL for the owner's own lesson-editor video
 * preview. Student playback uses a separate, enrollment-checked path (B3). */
export async function getCourseVideoPreviewUrl(courseId: string, path: string) {
  const { supabase, user } = await requireAuth();
  await requireCourseOwner(supabase, courseId, user.id);
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("course-videos").createSignedUrl(path, 3600);
  if (error || !data) return { error: error?.message ?? "Could not load video" };
  return { url: data.signedUrl };
}
