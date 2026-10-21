# Schema map — Sage Studio public API / MCP server (M0)

Real tables and permission model this feature builds against, replacing every "workspace"-shaped assumption in the original Grok spec. No staging environment — confirmed with Will 2026-10-21, not needed at current scale (him + a couple friends); build and test directly, using disposable test accounts for verification, same pattern as every other feature this project.

## Tenant model

**There is no workspace.** The tenant is the individual `user_id` (Supabase `auth.users.id`). A `connected_apps` grant belongs to one user; there is no workspace picker, no workspace-wide role.

## Modules → real tables

| Module | Tables | Ownership | RLS today | Collaborators? |
|---|---|---|---|---|
| `todos` | `todos` | `user_id` | `true` — policy "Users can manage their own todos": `using/check (auth.uid() = user_id)` | No — single-owner only |
| `knowledge` | `knowledge_sections`, `knowledge_entries` | `user_id` | `true` — policy "Users manage own knowledge entries": `using/check (auth.uid() = user_id)` | No |
| `time_tracking` | `time_entries` | `user_id` | `true` — policy "Users manage own time entries": `using/check (user_id = auth.uid())` | No |
| `sites` | `artist_sites`, `site_pages`, `site_posts` | `artist_sites.user_id` | `true` on all three | **Yes** — `site_collaborators` (`SiteRole`: owner/manager/editor/viewer, `lib/access/site-access.ts`'s `hasAtLeast`) |
| `finance` | `finance_entities`, `chart_of_accounts`, `transactions`, `invoices` (+ `invoice_line_items`, `invoice_payments`) | `finance_entities.owner_id` | `true` on all checked | **Yes** — `finance_entity_members` (role owner/manager/editor/viewer), `lib/access/finance-access.ts`'s `requireFinanceEntityRole` |
| `courses` | `courses`, `course_modules`, `lessons`, `enrollments` | `courses.owner_id` | `true` on all | No instructor-side collaborators; `enrollments` has its own per-student RLS already (see B1-era policies) |

No `tasks_projects`, `crm_*`, `web_pages`-as-named, `funnels`, `forms`-as-entities, or `kb_notebooks` exist — dropped from the spec's module list entirely rather than stubbed.

## What this means for RLS policy work in M1

- **Single-owner modules (`todos`, `knowledge`, `time_tracking`):** existing policies already correctly scope by `auth.uid()` regardless of which channel (web/API/MCP) the request comes through. **No new RLS policy is required for these** — the `withRls` claims-setting still happens (so `auth.uid()` resolves correctly for a bearer-token request the same way it does for a cookie session), but the restrictive "API channel can only see what its scope allows" check lives in the operation registry (app code checks `principal.scopes` before ever calling the DB), not in a new policy. Simpler than the spec assumed.
- **Collaborator modules (`sites`, `finance`):** this is where a new *restrictive* RLS policy earns its keep. A user's existing `SiteRole`/Finance role may be broader than what they chose to grant a given connection (e.g. they're an editor on a site, but only granted a connection `sites:read`) — app-code scope checks are the primary gate, but a restrictive policy scoped to the connection's granted scope is worth adding here as real defense-in-depth, since a bug in the app-code check would otherwise fall through to "whatever the user's own role allows," which is a bigger blast radius than for the single-owner tables above.
- No table needed enabling RLS from scratch — everything relevant already has it on. No blockers found.

## Open items carried into M1

- `enrollments`/course-side RLS already has its own helper functions (`owns_course`, `is_enrolled_in_course`, etc. — see `scripts/add-lms-schema.ts`) from the LMS build; the new restrictive API-channel policy for `courses` should compose with those, not replace them.
- No staging environment exists for this project and none is being built — explicitly confirmed with Will. Client testing (the spec's M8) happens directly against production with disposable test accounts/connections, cleaned up after verification, the same pattern used for every Playwright verification this session.
