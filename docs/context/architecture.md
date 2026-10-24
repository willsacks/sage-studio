# Architecture

## Stack

Next.js 16 App Router (React 19, Server Components + Server Actions), Supabase (Postgres + auth + storage, via `@supabase/ssr`), Tailwind 4, Zustand for builder state, deployed on Vercel. Auth is **magic-link only**: no passwords.

## Layout

| Path | What lives there |
|---|---|
| `app/(dashboard)/` | The signed-in app. One folder per sidebar module: `finances`, `courses`, `my-courses`, `newsletter`, `pipeline`, `process-game`, `todos`, `tasks`, `knowledge`, `my-site`, `my-templates`, `settings`, `billing`, `admin` |
| `app/(builder)/my-site/[siteId]/...` | The full-screen site/page builder |
| `app/(auth)/` | Login, onboarding |
| `app/sites/[slug]/...` | **Public** rendering of creator sites (also served on custom domains, see `proxy.ts`) |
| `app/api/` | Route handlers: webhooks (`stripe`, `stripe-connect`, Plaid under `finance/webhooks`), checkout (`checkout`, `course-checkout`, `guild-checkout`), `cron/backup`, finance import/sync/export, large-payload endpoints (`site-pages`), the public API (`v1/[...path]`, `mcp`, `oauth/*`) |
| `app/oauth/authorize` | OAuth consent screen for the public API |
| `proxy.ts` | Next 16's replacement for `middleware.ts`: Supabase session refresh + custom-domain routing |
| `lib/actions/` | Server Actions (`"use server"`), one file per domain. **All mutations go here.** Each re-checks auth itself |
| `lib/queries/` | Server-side read helpers |
| `lib/access/` | Role checks: `site-access.ts` (owner/manager/editor/viewer via `site_collaborators`), `finance-access.ts` (`requireFinanceEntityRole`), `platform-access.ts` (`canManagePlatform`) |
| `lib/supabase/` | `server.ts` (cookie-scoped client + `createAdminClient` service-role client), `client.ts` (browser) |
| `lib/finance/` | Ledger engine, Plaid, reports, QuickBooks/Wave import (see `modules/finances.md`) |
| `lib/server/` | The public API/MCP server: `contract/` (operation registry), `ops/` (one file per module, `*-write.ts` for mutations), `auth/` (OAuth, PATs, bearer), `db/` (raw `pg` with RLS claims) (see `modules/public-api-mcp.md`) |
| `lib/email/` | Resend client + subscriber capture |
| `lib/db.ts` | **Hand-maintained** Supabase types. Incomplete and sometimes wrong; see `database.md` |
| `lib/crypto.ts` | Per-integration encryption (Resend keys, Plaid tokens, QBO tokens) + HMAC gate tokens |
| `components/<module>/` | UI, mirroring the module folders. `components/offer-builder/blocks/` holds the page-builder blocks |
| `scripts/` | One-off migrations (`add-*`, `fix-*`), backfills, seeders, `ci-safety-checks.ts`, `restore-from-backup.ts` |

## Patterns

- **Authorization is checked in every Server Action and route handler**, not only by page redirects. RLS is the second layer.
- **The service-role client (`createAdminClient`) bypasses RLS.** Use it only where a flow genuinely acts outside the user's own rights (webhooks, enrolling a paying student into someone else's course), after confirming the real user with the cookie-scoped client first. It is banned anywhere under the public API surface (enforced by `scripts/ci-safety-checks.ts`).
- **Multi-tenant model is per user** (`user_id` / `owner_id`), with collaborator tables for sites (`site_collaborators`) and finance entities (`finance_entity_members`). There's no "workspace". For anything acting on a site or entity, resolve plan gates and integrations from the **owner**, never from the acting collaborator.
- **Third-party integrations hand off and come back:** Stripe Checkout, Stripe Connect onboarding, Plaid Link, and QuickBooks OAuth all redirect out to the provider and return via a return URL, plus a webhook as the source of truth.
