# Courses

## Model

- `courses` (owned via `owner_id`) → `course_modules` → `lessons`. `lessons.content_type` is `text`, `video`, or `audio`, enforced by a CHECK constraint. `enrollments` link students to a course.
- Video and audio files live in the private `course-videos` and `course-audio` buckets. Uploads and playback go through signed URLs minted in `lib/actions/courses.ts`, after a `requireCourseOwner` check.
- RLS helpers live in `scripts/add-lms-schema.ts`: `owns_course`, `is_enrolled_in_course`, and others.
- Creators manage courses at `app/(dashboard)/courses/`. Students see theirs at `app/(dashboard)/my-courses/` (`StudentCourseView`).

## Selling courses (Stripe Connect)

- Creators connect a Stripe Connect Express account from Settings → Payments:
  - Logic: `lib/stripe-connect.ts`, `lib/actions/stripe-connect.ts`.
  - Return page: `app/(dashboard)/settings/stripe-connect-return/`.
  - `app/api/webhooks/stripe-connect/` tracks `charges_enabled` / `payouts_enabled`, with its own signing secret.
- Checkout: `app/api/course-checkout/` creates a destination charge with `application_fee_amount` taken from `profiles.course_platform_fee_bps` (default 0, which an admin can override from Platform Admin). Free courses skip Stripe and enroll the signed-in visitor directly. Signed-out visitors go to `/login?next=...`.
- Fulfilment: the `checkout_type: "course_enrollment"` branch in the **platform** webhook (`app/api/webhooks/stripe/`) creates the enrollment and, if the creator has a finance entity, records a paid invoice.
- The `course_enroll` block (`components/offer-builder/blocks/CourseEnrollBlock.tsx`) can go on any site or offer page.

## Course sites

`createSiteForCourse` builds a site with two pages:
- a normal home/sales page;
- a `page_type: "course_classroom"` page, gated by `requires_course_enrollment` / `gate_course_id` on `site_pages`. It renders `CourseClassroomContent` / `StudentCourseView` under `/sites/[slug]`.

This gate is separate from both the email-capture gate and the site-collaborator roles. Four "Course —" marketing templates are seeded into the shared `offer_templates` table (`scripts/seed-course-marketing-templates.ts`).
