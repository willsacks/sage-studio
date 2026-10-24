# Decisions

These are settled. Don't reopen them unless the human does. When you add one, include the reason.

- **No staging environment.** The user base is small (the owner plus a few friends). Verification runs against production with disposable test accounts that get cleaned up afterwards.
- **Newsletter/Resend is connected per account, not per site.** An artist with several sites wants one Resend connection and the ability to email everyone. Each site picks which lists its captured emails feed into (`artist_sites.resend_list_ids`). The old per-site Resend columns are dead but deliberately not dropped.
- **Finances is built around per-project profitability for creatives, not as a QuickBooks clone.** The double-entry ledger sits underneath. The primary UX is Projects / Transactions / Invoices / Reports. "Did this album make money" is a first-class report.
- **Personal and business finance entities are never mixed.** A user can have many entities, each with its own books.
- **Invoicing is lightweight.** No AR posting happens when an invoice is created. A journal entry is posted only when a payment is recorded.
- **Tax set-aside is a plain percentage, labelled "not tax advice".** There is no tax-bracket engine.
- **Unmatched incoming transactions post to Uncategorized Income/Expense right away**, so reports are never missing money. They stay flagged `uncategorized` for review.
- **Imports (QuickBooks/Wave) always create a brand-new entity**, never merge into an existing one. QuickBooks vendors merge into `finance_customers`. QuickBooks Bills import as memo-only, because there's no AP tracking.
- **Imported HTML pages keep raw scripts.** They're a feature. Isolation comes from the iframe sandbox, not from sanitizing.
- **Course payments use Stripe Connect Express destination charges.** Money goes to the creator. The platform fee defaults to 0%, since revenue comes from the Pro subscription. An admin can override the fee per creator (`profiles.course_platform_fee_bps`, nullable so an explicit 0% is different from "default").
- **Free courses are intentional.** A course with no price enrolls a signed-in visitor directly, with no Stripe.
- **The public API is one operation registry served over both REST and MCP.** Each capability is written once. Writes are opt-in per operation (`mutates: true` + `minScope: "write"`), and there are no money-movement tools.
- **Google Sheets sync for newsletter contacts is deferred** by the owner's choice. Only pick it up if asked.
