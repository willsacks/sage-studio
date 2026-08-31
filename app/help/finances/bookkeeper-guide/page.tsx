import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";

export const metadata: Metadata = { title: "Finances Bookkeeper Guide — Sage Studio" };

const TOC = [
  { id: "roles-and-access", label: "1. Roles & access" },
  { id: "chart-of-accounts", label: "2. Chart of accounts" },
  { id: "categorization-at-scale", label: "3. Categorization at scale" },
  { id: "reviewing-transactions", label: "4. Reviewing transactions" },
  { id: "reconciliation", label: "5. Bank reconciliation" },
  { id: "journal-entries", label: "6. Journal entries" },
  { id: "period-close", label: "7. Closing the period" },
  { id: "reports", label: "8. Reports" },
  { id: "trial-balance", label: "9. Trial balance & journal register" },
  { id: "audit-trail", label: "10. Audit trail" },
  { id: "cpa-export", label: "11. CPA export package" },
  { id: "close-checklist", label: "12. Suggested month-end close checklist" },
  { id: "known-limitations", label: "13. Known limitations" },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-lg font-semibold scroll-mt-20">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{children}</p>;
}
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-2 scroll-mt-20">
      <H2 id={`${id}-h`}>{title}</H2>
      {children}
    </section>
  );
}

export default function BookkeeperGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Leaf size={15} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="font-semibold tracking-tight">Sage Studio</span>
        </Link>
        <Link href="/help/finances/user-guide" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
          Looking for the user guide?
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 pb-24 space-y-10">
        <div>
          <h1 className="text-2xl font-bold">Finances — Bookkeeper & Accountant Guide</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">
            You&apos;ve been invited to help manage a client&apos;s books in Sage Studio. This covers the full
            double-entry ledger underneath the product: reconciliation, journal entries, period close, reports, and
            the audit trail. It assumes you already know standard bookkeeping practice — it&apos;s a guide to{" "}
            <em>this product&apos;s</em> implementation of it, not a bookkeeping primer.
          </p>
        </div>

        <nav className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-2">On this page</p>
          <ul className="space-y-1">
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="text-sm text-[var(--primary)] hover:underline">{t.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="roles-and-access" title="1. Roles & access">
          <P>Four roles, ranked: Viewer &lt; Editor &lt; Manager &lt; Owner.</P>
          <ul className="list-disc list-inside text-sm text-[var(--muted-foreground)] space-y-1 ml-1">
            <li><strong className="text-[var(--foreground)]">Viewer</strong> — read-only. Can see every transaction, report, and the audit trail, but can&apos;t change anything.</li>
            <li><strong className="text-[var(--foreground)]">Editor</strong> — everything a bookkeeper actually does day to day: categorize, post journal entries, reconcile accounts, create/pay bills and invoices. This is the typical bookkeeper role.</li>
            <li><strong className="text-[var(--foreground)]">Manager</strong> — Editor plus inviting/removing other collaborators.</li>
            <li><strong className="text-[var(--foreground)]">Owner</strong> — the client themself. Only the owner can rename or permanently delete the books, or close/reopen a period — this is deliberate: period close is a control the client&apos;s own account holds, not something a collaborator can silently do.</li>
          </ul>
          <P>
            You&apos;ll typically be invited as Editor. If you need to bring on a second bookkeeper or assistant
            yourself, ask the owner to invite you as Manager instead.
          </P>
        </Section>

        <Section id="chart-of-accounts" title="2. Chart of accounts">
          <P>
            Standard five types — asset, liability, equity, income, expense — each with a subtype for grouping on
            reports (e.g. asset/&quot;Cash and Bank&quot;, asset/&quot;Fixed Asset&quot;, expense/&quot;Operating
            Expense&quot;). Every entity starts with a seeded default chart tailored to personal or business books;
            adjust freely.
          </P>
          <P>
            There&apos;s no hard delete on an account with any history — <strong className="text-[var(--foreground)]">archive</strong> (toggle
            inactive) instead of trying to remove one that&apos;s been used. Archived accounts drop out of
            category pickers but their historical balances still report correctly.
          </P>
        </Section>

        <Section id="categorization-at-scale" title="3. Categorization at scale">
          <P>
            <strong className="text-[var(--foreground)]">Rules</strong> (Bank Accounts tab) match a payee name
            (contains/exact/starts-with) to a category and, optionally, a project — set once, apply to every future
            matching transaction automatically. A rule only ever affects <em>future</em> transactions when created;
            use <strong className="text-[var(--foreground)]">&quot;Apply rules to existing transactions&quot;</strong> right
            next to the rules list to retroactively sweep the backlog a new rule should have caught.
          </P>
          <P>
            The <strong className="text-[var(--foreground)]">AI categorization assistant</strong> (sparkle icon,
            Transactions tab) takes a plain-language instruction — e.g. &quot;Citi autopay transactions are credit
            card payments, anything with Adobe is software&quot; — creates the underlying rules, and applies them to
            matching existing transactions immediately, reporting back exactly what it did. Useful for bulk cleanup
            on a new import; always spot-check its work afterward the same way you&apos;d review any junior staff
            categorization.
          </P>
        </Section>

        <Section id="reviewing-transactions" title="4. Reviewing transactions">
          <P>
            Any collaborator can flag a transaction for the owner&apos;s attention with an optional note (useful when
            you genuinely can&apos;t determine the right category without asking). Splits let a single transaction
            post to multiple categories and/or projects at once — the split amounts must add up to exactly the
            transaction total.
          </P>
        </Section>

        <Section id="reconciliation" title="5. Bank reconciliation">
          <P>
            From the Bank Accounts tab, click the reconcile icon next to any account (works for Plaid-connected,
            manually-added, or imported accounts alike). Enter the statement period and its ending balance to start.
          </P>
          <P>
            Check off every transaction that appears on the physical/downloaded statement. The running{" "}
            <strong className="text-[var(--foreground)]">Difference</strong> must reach exactly $0.00 —
            beginning balance plus everything you&apos;ve cleared has to equal the statement&apos;s ending balance —
            before <strong className="text-[var(--foreground)]">Finish reconciling</strong> becomes available. There&apos;s
            no partial-reconcile or force-through option by design: if it doesn&apos;t balance, something&apos;s
            missing or miscategorized and needs to be found before moving on, the same discipline as reconciling on
            paper.
          </P>
          <P>
            Finishing a reconciliation <strong className="text-[var(--foreground)]">locks</strong> every journal
            entry behind the cleared transactions — they can&apos;t be edited or deleted afterward without first
            reopening that reconciliation. Only the <em>most recent</em> reconciliation on an account can be reopened,
            to keep history in order (reconcile-in-order, no gaps).
          </P>
        </Section>

        <Section id="journal-entries" title="6. Journal entries">
          <P>
            &quot;New journal entry&quot; on the Reports tab posts a free-form debit/credit entry not tied to any
            bank transaction — the right tool for accruals, depreciation, and opening balances. Add as many lines as
            needed; total debits must equal total credits exactly before it&apos;ll post. A journal entry you post
            here shows up in account drilldowns and reports exactly like a categorized transaction would, tagged
            &quot;journal entry&quot; so it&apos;s clear at a glance where it came from.
          </P>
          <P>
            Deleting a manual journal entry posts an equal-and-opposite <strong className="text-[var(--foreground)]">reversal</strong>,
            not a hard delete — the original stays visible for audit purposes, netting to zero. This is the same
            convention recategorizing a transaction uses under the hood.
          </P>
        </Section>

        <Section id="period-close" title="7. Closing the period">
          <P>
            In Settings (owner-only), &quot;Close through this date&quot; locks the entire ledger through that date —
            no transaction, journal entry, or reconciliation-driven edit dated on or before it can be added, edited,
            or deleted by anyone, including the owner, until the books are reopened. This is the mechanism that
            actually protects a signed-off month: once you&apos;ve reconciled everything and the reports look right,
            ask the owner to close through the period end date.
          </P>
          <P>
            Reopening is a full reopen (not partial) — if a correction is needed after close, reopen, make the fix,
            and close again through the same or a later date. Only the owner can close or reopen; if you find an
            error in a closed period, flag it to them rather than asking them to just leave it open indefinitely.
          </P>
          <P>Recommended cadence: reconcile every connected account, review the reports, then close through the last day of the month once everything ties out.</P>
        </Section>

        <Section id="reports" title="8. Reports">
          <ul className="list-disc list-inside text-sm text-[var(--muted-foreground)] space-y-1 ml-1">
            <li><strong className="text-[var(--foreground)]">Income Statement</strong> — income and expenses over a date range; click any account row to drill into its transactions and recategorize inline.</li>
            <li><strong className="text-[var(--foreground)]">Balance Sheet</strong> — assets/liabilities/equity as of a single date, with current-year net income rolled into equity as &quot;Retained Earnings (YTD)&quot; automatically (no manual year-end closing entry required).</li>
            <li><strong className="text-[var(--foreground)]">Trends</strong> — income/expense and cash-balance-over-time charts across a rolling window (3–24 months).</li>
            <li><strong className="text-[var(--foreground)]">Project Comparison</strong> — net profit by project, for job-costing.</li>
          </ul>
        </Section>

        <Section id="trial-balance" title="9. Trial balance & journal register">
          <P>
            These two live inside the CPA export package rather than as their own report tab — the trial balance
            gives each account&apos;s net balance split into a proper Debit/Credit column (not the signed number the
            other reports use internally), and the journal register is the raw line-by-line detail across every
            posted entry. Total debits and total credits on the trial balance should always match exactly; if
            they don&apos;t, something in the underlying data is inconsistent and worth investigating before relying
            on the summarized reports.
          </P>
        </Section>

        <Section id="audit-trail" title="10. Audit trail">
          <P>
            The Activity tab logs who created, categorized, or deleted a transaction; posted or deleted a journal
            entry; created or archived an account; created a bill/invoice or recorded a payment against one; and
            closed or reopened the books — with the actor&apos;s name, a timestamp, and an expandable diff of exactly
            what changed. Use it to answer &quot;why did this change&quot; without having to ask, and expect the
            client&apos;s owner to use it to review your own work too.
          </P>
        </Section>

        <Section id="cpa-export" title="11. CPA export package">
          <P>
            &quot;Export CPA package&quot; on the Reports tab downloads a ZIP for a given year containing: chart of
            accounts, income statement, balance sheet, trial balance, journal register, project profitability, and a
            full transaction listing (date, payee, amount, status, categories, projects). This is the handoff package
            for an outside CPA at tax time — everything needed to prepare a return without needing live access to the
            books.
          </P>
        </Section>

        <Section id="close-checklist" title="12. Suggested month-end close checklist">
          <ol className="list-decimal list-inside text-sm text-[var(--muted-foreground)] space-y-1 ml-1">
            <li>Sync/import all transactions for the month; categorize everything (rules + AI assistant for bulk, manual for the rest).</li>
            <li>Resolve any flagged-for-review transactions.</li>
            <li>Reconcile every connected bank/credit-card account against its statement.</li>
            <li>Post any needed journal entries (accruals, depreciation, corrections).</li>
            <li>Review the Income Statement and Balance Sheet for anything that looks off (an account with an unexpected sign, a category that&apos;s empty when it shouldn&apos;t be).</li>
            <li>Confirm the trial balance ties (debits = credits) via the CPA export.</li>
            <li>Ask the owner to close the books through the last day of the month.</li>
          </ol>
        </Section>

        <Section id="known-limitations" title="13. Known limitations">
          <P>Worth knowing up front so nothing here is a surprise mid-close:</P>
          <ul className="list-disc list-inside text-sm text-[var(--muted-foreground)] space-y-1 ml-1">
            <li>No dedicated AP/AR aging report yet — Bills and Invoices each show status, but there&apos;s no aging-buckets view across all of them.</li>
            <li>No multi-currency support — one currency per entity.</li>
            <li>No fixed-asset depreciation schedules — post depreciation manually via journal entries.</li>
            <li>No sales-tax tracking/liability account — only a flat income-tax set-aside estimate exists, and it&apos;s explicitly not tax advice.</li>
            <li>No account merge — archive a duplicate rather than trying to combine it into another.</li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
