# Deploy

- Vercel project linked to GitHub `willsacks/sage-studio`; production domain **sagestudio.org**.
- **Push to `main` = automatic production deploy** (~1 min). Every PR/branch gets a preview deployment.
- Check status: `npx vercel ls --yes` (Building / Ready / Error). Server errors: `npx vercel logs <url>`.
- `prebuild` runs `scripts/ci-safety-checks.ts`, so a safety violation fails the deploy.
- After a production deploy, verify the live site actually reflects the change (curl the affected URL), not just that the build went Ready.

## Who deploys

- **Interactive session with the human, who asked to ship:** commit → push `main` → wait for Ready → spot-check live.
- **Unattended agent:** never. Open a PR; the human merges.

## Cron

`vercel.json`: `/api/cron/backup` daily 08:00 UTC — exports every table + storage bucket to Cloudflare R2. Requires `CRON_SECRET` and the `CLOUDFLARE_R2_*` vars (see `open-work.md` for activation status). `scripts/restore-from-backup.ts` restores one table/bucket at a time behind `--confirm`.

## Environment variables

Set in Vercel project settings and in local `.env.local` (never committed). Adding a new one means adding it to **both** and listing it here.

| Area | Vars |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| App | `NEXT_PUBLIC_APP_URL` |
| Stripe (platform) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SAGE_STUDIO_PRICE_FREE`, `STRIPE_SAGE_STUDIO_PRICE_PRO` |
| Stripe Connect | `STRIPE_CONNECT_WEBHOOK_SECRET` (separate endpoint, registered by `scripts/create-stripe-connect-webhook.ts`) |
| Plaid | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_REDIRECT_URI`, `PLAID_TOKEN_ENCRYPTION_SECRET` |
| QuickBooks | `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_ENVIRONMENT`, `QBO_TOKEN_ENCRYPTION_SECRET` |
| Resend | `RESEND_API_KEY` (platform mail), `RESEND_KEY_ENCRYPTION_SECRET` (encrypts users' own keys) |
| Public API | `SAGE_API_DATABASE_URL`, `SAGE_API_DB_PASSWORD`, `SAGE_OAUTH_SIGNING_KEY`, `ASSISTANT_TOKEN_HASH_SECRET` |
| AI | `ANTHROPIC_API_KEY` |
| Custom domains | `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` |
| Backups | `CRON_SECRET`, `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `BACKUP_ALERT_EMAIL` |

Each integration has its **own** encryption secret — don't reuse one across integrations.
