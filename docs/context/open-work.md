# Open work

Work that's deferred, blocked, or half-finished. Add an entry when you leave something incomplete, and remove it when it's done.

## Blocked on the human

- **Offsite backups are inactive.** The cron route is deployed but returns 401 until the `CLOUDFLARE_R2_*`, `CRON_SECRET`, and `BACKUP_ALERT_EMAIL` env vars are set in Vercel. The Supabase project is also on the free tier, which has no automatic backups of its own.
- **The QuickBooks import has never run against real QuickBooks.** It's blocked on `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` from developer.intuit.com (redirect URI `https://sagestudio.org/api/finance/qbo/callback`).
- **`SUPABASE_ACCESS_TOKEN` in `.env.local` is stale (401)**, so Management API SQL queries don't work. Use PostgREST introspection or `exec_sql` instead, or rotate the token.

## Not built yet

- QuickBooks Phase 3+: Deposit, Purchase, JournalEntry, Transfer, Bill (memo-only), BillPayment, CreditCardPayment.
- Wave transaction/invoice history import. This also needs a real sample Wave invoice export.
- No retry or delete-on-failure UI for a partially failed import.
- CPA export covers one calendar year at a time, with no custom date range.
- There's no dedicated "promote to manager" flow for finance collaborators.
- Newsletter: Google Sheets contact sync (deferred, see `decisions.md`).

## In progress

- **Audio lessons** (2026-10-24, uncommitted in the owner's checkout). Adds a `content_type: "audio"` lesson type mirroring video: an `audio_path` column, a private `course-audio` bucket, and `scripts/add-audio-lessons.ts`.
