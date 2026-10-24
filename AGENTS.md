<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sage Studio — agent guide

Sage Studio (sagestudio.org) is an all-in-one workspace for creative people: website/offer-page builder, courses, finances, newsletter, pipeline/CRM, todos, time tracking, knowledge base, and a public API/MCP server so AI assistants can act on a user's account. Next.js 16 (App Router) + React 19 + Supabase (Postgres, auth, storage) + Tailwind 4, deployed on Vercel.

This file is the entry point for **every** coding agent (Claude, Grok, Codex, …). Several agents work on this repo, often in parallel and unattended. The repo is the only context you share with them — so read before you change, and write down what you learned before you finish.

## Read before you start

1. This file, all of it.
2. `docs/context/gotchas.md` — mistakes that have already cost real time. Short; read it every time.
3. The context file for the area you're touching (index below).
4. `git log --oneline -20` and any open PRs (`gh pr list`) — another agent may be mid-change in the same files.

## Context index

| File | What's in it |
|---|---|
| `docs/context/architecture.md` | Directory layout, how a request flows, where each kind of code lives |
| `docs/context/database.md` | The **shared** Supabase project, migrations, RLS, `lib/db.ts` types |
| `docs/context/gotchas.md` | Non-obvious traps (Server Actions limits, type re-exports, iframe sandbox, …) |
| `docs/context/testing.md` | How to verify changes — typecheck, safety CI, disposable-user E2E harness |
| `docs/context/deploy.md` | Vercel, env vars, cron, what triggers a production deploy |
| `docs/context/decisions.md` | Locked product/architecture decisions — don't re-litigate these |
| `docs/context/open-work.md` | Deferred, blocked, and in-progress work |
| `docs/context/modules/*.md` | One file per module: finances, courses, newsletter, public-api-mcp |
| `docs/schema-map.md` | Table → module → RLS map used by the public API |

## Commands

```bash
npm run dev              # local dev server
npx tsc --noEmit         # typecheck — must pass before any commit
npm run safety-check     # API/MCP safety CI (also runs automatically as prebuild)
npm run build            # full production build (runs safety-check first)
```

There is no unit-test suite and no linter configured. Typecheck + safety-check + build are the gate.

## Hard rules

1. **Never push to `main` unless the human explicitly told you to in this session.** A push to `main` is an immediate production deploy (Vercel auto-deploys). Unattended/background agents always work on a branch and open a PR; the human merges.
2. **Production is the only database.** There is no staging environment. `.env.local` points at the live Supabase project, which is **shared with other products** (see `docs/context/database.md`). Unattended agents must not run schema migrations, `exec_sql`, backfills, or any `scripts/*.ts` that writes data. Write the migration script, put "needs migration run" in the PR description, and stop.
3. **Never drop or alter a table/column just because this repo doesn't reference it.** Other apps use it.
4. **Don't commit secrets.** `.env*` is gitignored; keep it that way. This repo is public.
5. **Don't commit work that isn't yours.** Other agents may have uncommitted changes in the same working tree. Stage files explicitly by path — never `git add -A` / `git add .` / `git commit -a`.
6. **Update context in the same commit as the code** (see below). A change isn't done until the docs that describe it are true.

## Keeping context current

When your change makes any `docs/context/` file wrong or incomplete, fix that file in the same commit. Specifically:

- New module, route, table, env var, or cron → update the relevant module file + `architecture.md` / `database.md` / `deploy.md`.
- You lost time to something non-obvious → add it to `gotchas.md` (symptom, cause, fix — a few lines).
- A product/architecture decision got made → add it to `decisions.md` with the *why*.
- Something is deferred, blocked on the human, or half-done → `open-work.md`. Remove entries when they're finished.

Keep entries short and factual. Write for an agent that has never seen this repo. Don't log a diary of what you did — that belongs in the commit message and PR description.

## Workflow for unattended agents (bug fixes, recurring tasks)

1. **Claim the task.** Comment on / self-assign the GitHub issue before starting, so two agents don't fix the same bug. If someone else already claimed it, pick something else.
2. **Branch** from up-to-date `main`: `git fetch origin && git switch -c agent/<agent-name>/<short-slug> origin/main`. One branch per task. Use a separate worktree if another agent shares this checkout.
3. **Reproduce first**, then fix. Prefer the smallest change that fixes the root cause; don't refactor neighboring code.
4. **Verify**: `npx tsc --noEmit` and `npm run build` pass. For RLS/auth/browser-only behavior, see `docs/context/testing.md`.
5. **Update context docs** in the same commit.
6. **Open a PR** using the template (`.github/pull_request_template.md`): what broke, root cause, the fix, how you verified it, anything left for the human (migrations to run, env vars to add, decisions to make). Vercel builds a preview deployment for every PR.
7. **Stop.** Don't merge your own PR. If you're blocked on a decision, credential, or production action, say so in the PR or issue rather than guessing.

## Conventions

- Mutations are Server Actions in `lib/actions/*.ts` (`"use server"`), each re-checking auth/role itself — never rely on page-level redirects for authorization. Reads live in `lib/queries/`.
- Large payloads (>~1MB) go through route handlers in `app/api/`, not Server Actions (see gotchas).
- Schema changes are one-off `scripts/add-*.ts` / `scripts/fix-*.ts` files that run SQL via the `exec_sql` RPC. Name them for what they do; keep them in the repo after they run as the migration record.
- Comments explain *why*, at the density of the surrounding code. Match existing idioms before inventing new ones.
- Commit messages: a short imperative subject, then a body explaining what was wrong and why the fix is right.
