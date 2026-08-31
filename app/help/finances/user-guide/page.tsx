import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";

export const metadata: Metadata = { title: "Finances User Guide — Sage Studio" };

const TOC = [
  { id: "getting-started", label: "1. Getting started" },
  { id: "everyday-transactions", label: "2. Everyday transactions" },
  { id: "projects", label: "3. Projects" },
  { id: "invoicing-clients", label: "4. Invoicing clients" },
  { id: "bills", label: "5. Bills" },
  { id: "overview-dashboard", label: "6. The Overview dashboard" },
  { id: "inviting-a-bookkeeper", label: "7. Inviting a bookkeeper" },
  { id: "faq", label: "8. FAQ" },
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

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Leaf size={15} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="font-semibold tracking-tight">Sage Studio</span>
        </Link>
        <Link href="/help/finances/bookkeeper-guide" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
          Looking for the bookkeeper guide?
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 pb-24 space-y-10">
        <div>
          <h1 className="text-2xl font-bold">Finances — User Guide</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">
            This is the plain-English guide to the Finances section of Sage Studio — tracking money in and out of
            your personal life, your business, or both, without needing to know accounting jargon. If you&apos;re a
            bookkeeper or accountant looking for the reconciliation/close-the-books workflow, you want the{" "}
            <Link href="/help/finances/bookkeeper-guide" className="text-[var(--primary)] hover:underline">bookkeeper guide</Link> instead.
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

        <Section id="getting-started" title="1. Getting started">
          <P>
            Everything in Finances lives inside a <strong className="text-[var(--foreground)]">set of books</strong> —
            Sage Studio calls these an &quot;entity.&quot; You can have more than one: most people keep a{" "}
            <strong className="text-[var(--foreground)]">personal</strong> set of books for their own spending and a{" "}
            <strong className="text-[var(--foreground)]">business</strong> set for a studio, LLC, or side business, kept
            completely separate. Switch between them anytime with the dropdown at the top of the Finances page.
          </P>
          <P>
            When you create a new set of books, Sage Studio seeds it with a starter chart of accounts — categories
            like Groceries and Housing for personal books, or Performance Revenue and Studio Costs for a creative
            business. You can rename, add, or archive categories anytime from the Chart of Accounts tab; you don&apos;t
            need to get this perfect on day one.
          </P>
          <P>
            You can also start from an import instead of a blank slate: connect a QuickBooks Online company, or
            upload a Wave export, and Sage Studio builds your books (accounts, customers, and history) from that data
            automatically.
          </P>
        </Section>

        <Section id="everyday-transactions" title="2. Everyday transactions">
          <P>
            The Transactions tab is where day-to-day money movement lives. There are three ways transactions get in:
          </P>
          <ul className="list-disc list-inside text-sm text-[var(--muted-foreground)] space-y-1 ml-1">
            <li><strong className="text-[var(--foreground)]">Connect a bank</strong> (Bank Accounts tab) via Plaid — new transactions sync in automatically and you just categorize them.</li>
            <li><strong className="text-[var(--foreground)]">Import a CSV</strong> from your bank if it&apos;s not supported by Plaid.</li>
            <li><strong className="text-[var(--foreground)]">Add one manually</strong> — cash spending, or anything that didn&apos;t come through a bank feed.</li>
          </ul>
          <P>
            Categorizing means picking which account (category) a transaction belongs to — a client payment might be
            &quot;Performance Revenue,&quot; a coffee run might be &quot;Materials & Supplies.&quot; A transaction can
            also be <strong className="text-[var(--foreground)]">split</strong> across more than one category if it
            covered multiple things. If you find yourself categorizing the same payee the same way over and over, set
            up a rule (Bank Accounts tab) so future transactions from that payee categorize themselves — or use the AI
            assistant (the sparkle icon on the Transactions tab) and just describe what you want in plain language,
            e.g. &quot;anything from Adobe is a software expense.&quot;
          </P>
        </Section>

        <Section id="projects" title="3. Projects">
          <P>
            If you do client or job-based work, Projects let you tag transactions and invoices to a specific job (a
            client name, an event, an album) and see exactly what it earned versus what it cost — revenue, expenses,
            net profit, and margin, computed automatically from the transactions you&apos;ve tagged to it. Create a
            project once, then pick it whenever you categorize a related transaction or invoice.
          </P>
        </Section>

        <Section id="invoicing-clients" title="4. Invoicing clients">
          <P>
            The Invoices tab lets you bill a client directly from Sage Studio: add their name, line items, and a due
            date, then mark it sent. When they pay, record the payment (in full or in part) against the invoice and
            it&apos;s automatically deposited to whichever account you choose and counted as income — you don&apos;t
            need to also add it as a separate transaction. An invoice&apos;s status (draft → sent → partial → paid)
            updates itself as payments come in.
          </P>
        </Section>

        <Section id="bills" title="5. Bills">
          <P>
            Bills are the mirror image of invoices — money you owe instead of money owed to you. Log a vendor bill
            (rent, a contractor invoice, a subscription renewal) with its line items and due date, then record a
            payment against it when you actually pay. Like invoices, a bill can be paid in more than one installment
            and its status tracks that automatically.
          </P>
        </Section>

        <Section id="overview-dashboard" title="6. The Overview dashboard">
          <P>
            Overview is your at-a-glance snapshot: cash on hand, this month&apos;s income and expenses, your most
            profitable project, a 12-month income-vs-expenses trend, and pie-chart breakdowns of income and expenses
            by category over whatever date range you pick.
          </P>
          <P>
            Business books also show a <strong className="text-[var(--foreground)]">tax set-aside estimate</strong> —
            a rough suggestion (default 27%) of what to hold back from your net income for taxes. This is a planning
            estimate only, not tax advice — confirm your actual obligation with a CPA or tax professional, especially
            once you bring one on.
          </P>
        </Section>

        <Section id="inviting-a-bookkeeper" title="7. Inviting a bookkeeper">
          <P>
            Click <strong className="text-[var(--foreground)]">Share access</strong> at the top of the Finances page,
            enter your bookkeeper&apos;s email, and choose a role:
          </P>
          <ul className="list-disc list-inside text-sm text-[var(--muted-foreground)] space-y-1 ml-1">
            <li><strong className="text-[var(--foreground)]">Viewer</strong> — can look at everything, change nothing. Good for an accountant who just wants to review.</li>
            <li><strong className="text-[var(--foreground)]">Editor</strong> — can categorize transactions, post journal entries, reconcile accounts. The right level for most bookkeepers.</li>
            <li><strong className="text-[var(--foreground)]">Manager</strong> — everything Editor can do, plus inviting/removing other collaborators.</li>
          </ul>
          <P>
            Only you, the owner, can rename or delete the books, or close/reopen a period — collaborators at any
            role can&apos;t take those actions even if invited as Manager. Send them the{" "}
            <Link href="/help/finances/bookkeeper-guide" className="text-[var(--primary)] hover:underline">bookkeeper guide</Link> once
            they&apos;re invited — it covers reconciliation, journal entries, and period close in depth.
          </P>
        </Section>

        <Section id="faq" title="8. FAQ">
          <P>
            <strong className="text-[var(--foreground)]">Why can&apos;t I edit this transaction?</strong> The books
            may be closed through that date — a bookkeeper or owner closes a period once it&apos;s been reviewed and
            signed off, so it can&apos;t change by accident. Ask the owner to reopen it if a real correction is
            needed.
          </P>
          <P>
            <strong className="text-[var(--foreground)]">Why didn&apos;t my transaction show up when reconciling?</strong> Reconciliation
            only shows transactions dated on or before the statement&apos;s end date. Double-check the transaction
            date, and that it&apos;s posted to the account you&apos;re reconciling.
          </P>
          <P>
            <strong className="text-[var(--foreground)]">What&apos;s the difference between a Bill and just adding an expense transaction?</strong> A
            regular transaction is money that already moved. A Bill tracks money you owe before you&apos;ve paid it —
            useful for anything with a due date you want to keep an eye on.
          </P>
        </Section>
      </main>
    </div>
  );
}
