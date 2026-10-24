# Public API and MCP server

This lets external AI assistants (Claude, ChatGPT, Cursor, Grok, custom bots) read and act on a user's account.

## Surfaces

- MCP: `app/api/mcp/route.ts` (built on `mcp-handler`). REST: `app/api/v1/[...path]`. Both call the same `runOperation` pipeline, so each capability is written once.
- OAuth 2.1 authorization server:
  - DCR (`/api/oauth/register`) and CIMD client resolution
  - Consent screen with S256-only PKCE (`/oauth/authorize`)
  - Token endpoint with refresh rotation. Reuse of an auth code or refresh token revokes the whole grant.
  - Revoke, JWKS, and RFC 8414/9728 discovery
- Personal API keys, for assistants that can't do OAuth (`lib/server/auth/pat.ts`).
- User UI: Settings → Connected Apps (`components/settings/AssistantConnections.tsx`). Admin UI: `/admin/connections`, which also streams `sage.api_audit_log`.

## How operations work

- `lib/server/contract/registry.ts` collects operations from `lib/server/ops/<module>.ts` (reads) and `<module>-write.ts` (writes). Modules covered: todos, knowledge, time entries, sites, finance, courses, pipeline, process, newsletter.
- `Operation.mutates` decides the transaction type in `run-operation.ts`:
  - `withRlsWrite` when it's true;
  - `withRls` (`BEGIN READ ONLY`) otherwise.
- The registry throws at import time unless `mutates: true` ⇔ `minScope: "write"`.
- Queries run as the `sage_api` Postgres role with the user's RLS claims set (`lib/server/db/with-rls.ts`). `lib/server/db/privileged.ts` is the narrow no-RLS path, confined by CI.
- The finance write tools reuse `lib/finance/import-commit.ts` without changes, through `lib/server/db/supabase-shim.ts`. That's a minimal supabase-js-shaped query builder over `pg`, and it supports only the chain shapes those files actually use.
- **There are no money-movement tools.** `courses_add_enrollment` handles free and comp enrollments only.

## Adding an operation

1. Add it to the right `ops/` file. Writes go only in a `*-write.ts` file listed in `WRITE_FILES` in `scripts/ci-safety-checks.ts`, with `mutates: true, minScope: "write"`.
2. Reuse the web app's existing logic and permission floors. Don't reimplement them.
3. Run `npm run safety-check` and `npx tsc --noEmit`.
4. Do a security pass (`../testing.md`), since this is an external, untrusted surface.

## Safety CI (`scripts/ci-safety-checks.ts`, runs on every build)

- Mutating SQL appears only in allowlisted write files.
- Every operation in those files declares itself as a write.
- Privileged DB paths stay confined.
- `run-operation.ts` keeps read-only `withRls` as the default.
- `createAdminClient` never appears under the API/MCP surface.
