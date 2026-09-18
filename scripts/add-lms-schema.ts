/**
 * Core LMS data model (Track B, phase B1): courses -> course_modules ->
 * lessons, plus enrollments and per-lesson progress. Courses belong to a
 * user (owner_id), not a specific artist_sites row — a "Courses" area lives
 * alongside Finances/Newsletter as its own top-level product, matching the
 * plan's B2 note that this gets a new top-level nav item rather than being
 * embedded in the site builder.
 *
 * Video lessons store a private-bucket storage path (course-videos), never
 * a public URL — playback for enrolled students always goes through a
 * short-lived signed URL issued server-side after an enrollment check
 * (see B3), the same trust model already used for gated PDFs.
 *
 * Run: cd sage-studio && npx tsx scripts/add-lms-schema.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "create courses table",
    sql: `
      create table if not exists public.courses (
        id uuid primary key default gen_random_uuid(),
        owner_id uuid not null,
        title text not null,
        slug text not null unique,
        description text,
        cover_image_url text,
        status text not null default 'draft' check (status in ('draft','published')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    label: "create course_modules table",
    sql: `
      create table if not exists public.course_modules (
        id uuid primary key default gen_random_uuid(),
        course_id uuid not null references public.courses(id) on delete cascade,
        title text not null,
        sort_order int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    label: "create lessons table",
    sql: `
      create table if not exists public.lessons (
        id uuid primary key default gen_random_uuid(),
        module_id uuid not null references public.course_modules(id) on delete cascade,
        title text not null,
        sort_order int not null default 0,
        content_type text not null default 'text' check (content_type in ('text','video')),
        body text,
        video_path text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    label: "create enrollments table",
    sql: `
      create table if not exists public.enrollments (
        id uuid primary key default gen_random_uuid(),
        course_id uuid not null references public.courses(id) on delete cascade,
        user_id uuid,
        email text not null,
        status text not null default 'pending' check (status in ('pending','accepted')),
        source text not null default 'manual' check (source in ('manual','stripe')),
        enrolled_at timestamptz not null default now(),
        unique (course_id, email)
      );
    `,
  },
  {
    label: "create lesson_progress table",
    sql: `
      create table if not exists public.lesson_progress (
        id uuid primary key default gen_random_uuid(),
        enrollment_id uuid not null references public.enrollments(id) on delete cascade,
        lesson_id uuid not null references public.lessons(id) on delete cascade,
        completed_at timestamptz,
        last_position_seconds int not null default 0,
        updated_at timestamptz not null default now(),
        unique (enrollment_id, lesson_id)
      );
    `,
  },
  {
    label: "index course_modules by course",
    sql: `create index if not exists course_modules_course_id_idx on public.course_modules (course_id, sort_order);`,
  },
  {
    label: "index lessons by module",
    sql: `create index if not exists lessons_module_id_idx on public.lessons (module_id, sort_order);`,
  },
  {
    label: "index enrollments by course",
    sql: `create index if not exists enrollments_course_id_idx on public.enrollments (course_id);`,
  },
  {
    label: "index enrollments by user",
    sql: `create index if not exists enrollments_user_id_idx on public.enrollments (user_id);`,
  },
  {
    label: "index lesson_progress by enrollment",
    sql: `create index if not exists lesson_progress_enrollment_id_idx on public.lesson_progress (enrollment_id);`,
  },
  { label: "enable RLS on courses", sql: `alter table public.courses enable row level security;` },
  { label: "enable RLS on course_modules", sql: `alter table public.course_modules enable row level security;` },
  { label: "enable RLS on lessons", sql: `alter table public.lessons enable row level security;` },
  { label: "enable RLS on enrollments", sql: `alter table public.enrollments enable row level security;` },
  { label: "enable RLS on lesson_progress", sql: `alter table public.lesson_progress enable row level security;` },
  {
    // courses <-> enrollments RLS policies reference each other (a course's
    // "enrolled students can view" policy checks enrollments, whose "course
    // owner can manage" policy checks courses right back), which Postgres
    // evaluates recursively rather than short-circuiting — a raw exists()
    // cross-reference between the two tables triggers "infinite recursion
    // detected in policy for relation courses". These SECURITY DEFINER
    // functions are owned by the same role that owns these tables (postgres,
    // since exec_sql created them — table owners bypass RLS by default), so
    // calling them evaluates the underlying query with RLS off instead of
    // re-entering another table's policy, breaking the cycle.
    label: "RLS helper functions",
    sql: `
      create or replace function public.owns_course(p_course_id uuid)
      returns boolean language sql security definer set search_path = public stable as $$
        select exists (select 1 from public.courses where id = p_course_id and owner_id = auth.uid());
      $$;
      revoke all on function public.owns_course(uuid) from public;
      grant execute on function public.owns_course(uuid) to authenticated;

      create or replace function public.is_enrolled_in_course(p_course_id uuid)
      returns boolean language sql security definer set search_path = public stable as $$
        select exists (
          select 1 from public.enrollments
          where course_id = p_course_id and user_id = auth.uid() and status = 'accepted'
        );
      $$;
      revoke all on function public.is_enrolled_in_course(uuid) from public;
      grant execute on function public.is_enrolled_in_course(uuid) to authenticated;

      create or replace function public.course_id_for_module(p_module_id uuid)
      returns uuid language sql security definer set search_path = public stable as $$
        select course_id from public.course_modules where id = p_module_id;
      $$;
      revoke all on function public.course_id_for_module(uuid) from public;
      grant execute on function public.course_id_for_module(uuid) to authenticated;

      create or replace function public.course_id_for_enrollment(p_enrollment_id uuid)
      returns uuid language sql security definer set search_path = public stable as $$
        select course_id from public.enrollments where id = p_enrollment_id;
      $$;
      revoke all on function public.course_id_for_enrollment(uuid) from public;
      grant execute on function public.course_id_for_enrollment(uuid) to authenticated;

      create or replace function public.enrollment_user_id(p_enrollment_id uuid)
      returns uuid language sql security definer set search_path = public stable as $$
        select user_id from public.enrollments where id = p_enrollment_id;
      $$;
      revoke all on function public.enrollment_user_id(uuid) from public;
      grant execute on function public.enrollment_user_id(uuid) to authenticated;
    `,
  },
  {
    label: "policy: courses",
    sql: `
      drop policy if exists "Owners manage their courses" on public.courses;
      create policy "Owners manage their courses" on public.courses
        for all
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid());

      drop policy if exists "Enrolled students view their course" on public.courses;
      create policy "Enrolled students view their course" on public.courses
        for select
        using (public.is_enrolled_in_course(id));
    `,
  },
  {
    label: "policy: course_modules",
    sql: `
      drop policy if exists "Owners manage their course modules" on public.course_modules;
      create policy "Owners manage their course modules" on public.course_modules
        for all
        using (public.owns_course(course_id))
        with check (public.owns_course(course_id));

      drop policy if exists "Enrolled students view course modules" on public.course_modules;
      create policy "Enrolled students view course modules" on public.course_modules
        for select
        using (public.is_enrolled_in_course(course_id));
    `,
  },
  {
    label: "policy: lessons",
    sql: `
      drop policy if exists "Owners manage their lessons" on public.lessons;
      create policy "Owners manage their lessons" on public.lessons
        for all
        using (public.owns_course(public.course_id_for_module(module_id)))
        with check (public.owns_course(public.course_id_for_module(module_id)));

      drop policy if exists "Enrolled students view lessons" on public.lessons;
      create policy "Enrolled students view lessons" on public.lessons
        for select
        using (public.is_enrolled_in_course(public.course_id_for_module(module_id)));
    `,
  },
  {
    label: "policy: enrollments",
    sql: `
      drop policy if exists "Course owners manage enrollments" on public.enrollments;
      create policy "Course owners manage enrollments" on public.enrollments
        for all
        using (public.owns_course(course_id))
        with check (public.owns_course(course_id));

      drop policy if exists "Students view their own enrollment" on public.enrollments;
      create policy "Students view their own enrollment" on public.enrollments
        for select
        using (user_id = auth.uid());
    `,
  },
  {
    label: "policy: lesson_progress",
    sql: `
      drop policy if exists "Students manage their own progress" on public.lesson_progress;
      create policy "Students manage their own progress" on public.lesson_progress
        for all
        using (public.enrollment_user_id(enrollment_id) = auth.uid())
        with check (public.enrollment_user_id(enrollment_id) = auth.uid());

      drop policy if exists "Course owners view student progress" on public.lesson_progress;
      create policy "Course owners view student progress" on public.lesson_progress
        for select
        using (public.owns_course(public.course_id_for_enrollment(enrollment_id)));
    `,
  },
];

async function main() {
  let failed = false;
  for (const { label, sql } of STATEMENTS) {
    const { error } = await supabase.rpc("exec_sql" as never, { sql } as never);
    if (error) {
      console.error(`✗ ${label}: ${error.message}`);
      console.log(sql);
      failed = true;
    } else {
      console.log(`✓ ${label}`);
    }
  }

  // 50MB is this Supabase project's current global per-object ceiling (a
  // project-level setting only changeable in the dashboard, not via the
  // storage API — every value above 50MB was rejected when this ran). Raise
  // this once the project's Settings > Storage limit is increased.
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket("course-videos", {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
  });
  if (bucketError && !bucketError.message.includes("already exists")) {
    console.error(`✗ create course-videos bucket: ${bucketError.message}`);
    failed = true;
  } else {
    console.log(`✓ course-videos bucket ${bucket ? "created" : "already exists"}`);
  }

  // No storage.objects RLS policy is needed (and this project's exec_sql
  // role isn't the owner of that table, so one couldn't be added anyway):
  // uploads go through a signed upload URL minted server-side after an
  // ownership check, and playback goes through a signed read URL minted
  // server-side after an enrollment check — access control lives in our
  // own code, not in bucket RLS, for every course-videos operation.
  console.log(`✓ course-videos access control handled via signed URLs, no storage RLS needed`);

  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
