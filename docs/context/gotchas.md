# Gotchas

Each entry: symptom → cause → what to do. Add one whenever something non-obvious costs you time.

### Server Action fails on large input ("Maximum array nesting exceeded", ERROR 932982529)
React's Server Action argument decoder has a hardcoded ~1MB `arraySizeLimit`. `experimental.serverActions.bodySizeLimit` in `next.config.ts` does **not** affect it. Any action taking a big string (a full HTML page, a large JSON blob) fails at around 1MB. **Fix:** use a route handler in `app/api/` that reads `request.json()` / `.text()`. HTML page import and update already work this way (`app/api/site-pages/`).

### Whole page hangs or spins forever, with a scrubbed error in production
This happens when a `"use server"` file re-exports a type (`export type { Foo }`). The Server Actions compiler leaves a runtime reference behind, and every action in that file throws `ReferenceError`. **Never re-export types from `"use server"` files.** Import them from their source module instead. In general, if prod shows "An error occurred in the Server Components render", the real stack trace is only in `npx vercel logs`. Start tailing *before* reproducing (see `testing.md`).

### Insert fails with a CHECK constraint violation after adding a new enum value
TS unions such as `page_type` and `content_type` are mirrored by DB CHECK constraints. Widen the constraint with a migration as well.

### Batch insert puts NULL into a NOT NULL column that has a default
Supabase batch inserts use the union of all rows' keys. Give every row every column.

### Imported-HTML pages and iframes
Artist-authored raw HTML/JS is a core feature, so it isn't sanitized. Safety comes from the iframe sandbox. **Never combine `allow-scripts` with `allow-same-origin`**: together they let page script reach the parent window and hijack whoever views the page (often a higher-privileged owner).

### "Verified" but broken for real users
Smoke tests that use the service-role client bypass RLS *and* the Server Action layer. Test permission and UI-path changes as a real signed-in user.

### SDK method shapes differ from what you remember
Check the installed SDK's `.d.ts` in `node_modules` before using an API. Resend in particular:
- `audiences` is an alias of `segments`, and contacts take `segments: [{id}]`.
- `domains.list()` doesn't return DNS records (`get()` does).
- `domains.verify()` returns only `{id}`, so call `get()` afterwards.

The same applies to Next.js itself (see the top of `AGENTS.md`).

### Sign conventions in Finances
`transactions.amount` is positive for cash in and negative for cash out, whatever the account type. Plaid uses the opposite convention, and it's flipped exactly once, at ingestion (`lib/finance/plaid-sync.ts`). Don't flip it again.

### Every ledger write goes through the ledger helpers
Use `postJournalEntry` / `reverseJournalEntry` / `postImportedTransaction` / `postToUncategorizedBucket` in `lib/finance/ledger.ts`. A DB trigger enforces debits = credits. Never insert `journal_entry_lines` by hand.

### Safety-check regexes and comments
`scripts/ci-safety-checks.ts` strips line comments before scanning. That's because `//mutates: true` once passed as a real flag. When you add a static check, deliberately break the thing it guards to prove it catches it.
