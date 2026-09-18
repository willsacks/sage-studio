// Matches the course-videos bucket's project-level file size ceiling (see
// scripts/add-lms-schema.ts) — raise both together if the Supabase
// project's Settings > Storage limit is ever increased.
export const MAX_COURSE_VIDEO_BYTES = 50 * 1024 * 1024;
