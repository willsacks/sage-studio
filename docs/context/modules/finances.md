# Finances

A bookkeeping tool built around per-project profitability for creatives (did the album, tour, or residency make money?), running on a real double-entry ledger.

## Model

- `finance_entities` (type `personal` or `business`; a user can have many). Each entity has its own `chart_of_accounts`, its own books, and its own collaborators (`finance_entity_members`, with roles owner/manager/editor/viewer, invited by email + `invite_token`, accepted at `/finance-invite/[token]`).
- The ledger is `journal_entries` + `journal_entry_lines`. A DB trigger enforces debits = credits. Reconciliation locks the entries it covers (`is_locked`), and only the most recent reconciliation on an account can be reopened.
- `transactions` come from Plaid sync, CSV import, manual entry, or the API. `transaction_splits.project_id` is how money gets tagged to a creative project.
- Unmatched transactions post straight away to Uncategorized Income/Expense (`postToUncategorizedBucket`) and stay `status: "uncategorized"`. Recategorizing reverses that entry and posts a new one.
- Review workflow: an editor or anyone above can flag a transaction (`needs_review`, `review_note`). Categorizing it clears the flag.
- Invoices post a journal entry only when a payment is recorded. Course sales record an already-paid invoice in the creator's books (`lib/finance/course-invoice.ts`) when the creator has an entity.

## Key files

- `lib/finance/ledger.ts`: every ledger write goes through here.
- `lib/finance/categorize.ts`: `buildJournalLines` / `validateSplits`, shared by manual entry, the bank feed, and invoice payments.
- `lib/finance/reports.ts`: Balance Sheet, Income Statement, Project Profitability, and trend reports. It's split into fetch and pure-compute halves so the public API (raw `pg`) and the web app (supabase-js) use the same arithmetic.
- `lib/finance/plaid-client.ts`, `plaid-sync.ts`: shared by `/api/finance/sync` and the JWT-verified Plaid webhook (`/api/finance/webhooks/plaid`). Plaid tokens are encrypted with their own secret.
- `lib/finance/csv-import.ts`: a dependency-free CSV parser. It handles a signed amount column or separate debit/credit columns, plus mixed date formats. CSV rows set `transactions.money_account_id`, because they have no Plaid `bank_account_id`.
- Import from other tools:
  - Wave: `wave-import.ts` and `/api/finance/wave-import`.
  - QuickBooks:
    - OAuth: `lib/actions/finance-qbo.ts` and `/api/finance/qbo/callback`.
    - Import: `/api/finance/qbo/import`, which re-invokes itself in chunks with a resumable `cursor_state`.
    - Mapping: `qbo-mapping.ts`.
    - Commit: `import-commit.ts`.
- UI: `app/(dashboard)/finances/` and `components/finances/FinancesApp.tsx` (entity switcher plus tabs).
- Access: `lib/access/finance-access.ts` → `requireFinanceEntityRole`.

## Gotchas specific to this module

- Sign convention: see `../gotchas.md`.
- Role changes need both the app check and the RLS policy (`is_finance_entity_member` / `is_finance_entity_manager`). Test with a real user.
- Collaborator mutations must check the affected-row count. An RLS-blocked update returns no error.
