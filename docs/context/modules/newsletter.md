# Newsletter

- `/newsletter` has four tabs: Contacts, Compose, Sent, Domains. All actions are in `lib/actions/newsletter.ts`.
- The Resend connection is **per user**. `profiles.resend_api_key_encrypted` is encrypted with `RESEND_KEY_ENCRYPTION_SECRET`. `lib/email/resend-client.ts` → `getResendClientForUser` is the single entry point.
  - For anything site-related, resolve the connection from the **site owner**, never from the acting collaborator.
- Lists are Resend "segments", managed centrally. Each site picks which lists its captured emails join (`artist_sites.resend_list_ids`, set in `SiteNewsletterListsForm.tsx`).
- CSV contact import uses Resend's own `contacts.imports.create` through a route handler (`app/api/newsletter/import-contacts/`), because of the Server Action size limit.
- Compose sends with `resend.broadcasts.create({ ..., send: true })`. The Domains tab lets users add and verify their own sending domain.
- Email capture on sites happens in two places, gate blocks and page gates:
  - Unlock tokens are HMAC-signed (`signGateToken` / `verifyGateToken` in `lib/crypto.ts`).
  - Unlocks are rate-limited (`lib/utils/rate-limit.ts`).
  - Syncing to Resend is deferred with `after()`, so unlocking never waits on Resend.
- Per-user sidebar customization (`profiles.hidden_nav_items`, `NavVisibilityForm.tsx`) was added in the same build.
