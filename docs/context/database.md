# Database

## The Supabase project is shared, and it's production

- The Supabase project in `.env.local` holds about 54 tables, and only a fraction belong to Sage Studio. The rest serve **sibling products in other repos** that share the database: a CRM (`pipeline_*`, `opportunities`, `contacts`), a roadmap tool (`roadmap_*`), bookings (`bookable_slots`, `scheduled_sessions`, `*_bookings`), community (`announcements`, `moderator_permissions`), and "lanterns" (`lantern_*`). `offer_templates` is shared with creatorscircle.art.
- **A table being unreferenced in this repo does not mean it's dead.** Never drop, rename, or change the RLS of something you don't own.
- If a feature request mentions something that doesn't exist anywhere in this codebase (e.g. "lanterns"), it probably belongs to a sibling repo. Ask; don't build it here.
- **There is no staging database.** This was decided deliberately (small user base). Everything runs against production, so be careful with writes.
- Need "every table" (backups, audits)? Discover tables dynamically with `GET ${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/` and the service-role key: PostgREST's OpenAPI `definitions` lists them all. Never hardcode a list from `lib/db.ts`.

## `lib/db.ts` is hand-maintained

It is not generated, and it has been wrong before: `offer_templates` had made-up column names, which silently broke "save as template". Before trusting a column name in a new query, check it against the live schema. When you add a column through a migration, update `lib/db.ts` in the same commit.

## Migrations

- Each schema change is a one-off script in `scripts/` (`add-<thing>.ts` / `fix-<thing>.ts`). The script:
  - reads `.env.local`,
  - creates a service-role client,
  - runs the SQL through `supabase.rpc("exec_sql", { sql })`.

  For the template, copy a recent one such as `scripts/add-audio-lessons.ts`.
- `public.exec_sql(sql text)` is a SECURITY DEFINER function that only `service_role` can execute. It exists, so scripts run automatically and nobody has to paste SQL by hand.
- Make the SQL idempotent (`if not exists`, `drop constraint if exists`), so a re-run is harmless.
- **Postgres CHECK constraints act as enums here.** Adding a new value to a TS union (`site_pages.page_type`, `lessons.content_type`, and so on) also needs a migration that widens the constraint, or inserts fail at runtime.
- Supabase batch inserts send the **union of every row's keys**. If one row in a batch omits a column another row sets, the omitted one gets an explicit NULL, not the column default. Set every column on every row.
- Some FKs lack `ON DELETE CASCADE` (`todos.user_id`, for example). `auth.admin.deleteUser` then fails, so check its error.
- **Unattended agents write the script and stop.** They note "migration needs to run" in the PR, and a human runs it.

## RLS

- Every app table has RLS enabled. Single-owner tables scope by `auth.uid() = user_id`. Sites and finance add collaborator checks through SECURITY DEFINER helpers (`is_site_manager`, `is_finance_entity_member`, `is_finance_entity_manager`, and the course helpers `owns_course` / `is_enrolled_in_course`).
- **Service-role tests cannot catch RLS bugs**, because the service role bypasses RLS. A role/permission change counts as verified only after testing it as a real signed-in user (see `testing.md`). A manager-role bug once shipped because every smoke test used the admin client.
- The public API connects as a separate Postgres role (`sage_api`). It sets RLS claims per request through `lib/server/db/with-rls.ts`.

## Storage buckets

- Public: `media`, `announcement-images`, `avatars`, `offering-media`.
- Private: `course-videos` and `course-audio`, accessed only through signed upload/read URLs minted server-side after an ownership check.
