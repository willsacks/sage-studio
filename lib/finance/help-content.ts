export type HelpKey =
  | "overview"
  | "projects"
  | "transactions"
  | "invoices"
  | "bills"
  | "bank"
  | "reports"
  | "accounts"
  | "activity"
  | "reconciliation"
  | "journal-entry"
  | "period-close"
  | "collaborators";

export type HelpEntry = {
  title: string;
  summary: string;
  tips: string[];
  guideLinks: { label: string; href: string }[];
  /** Unset for now — no video content exists yet. The panel simply omits
   * this row rather than showing a "coming soon" placeholder; add a URL
   * here once a video exists and it'll appear automatically. */
  videoUrl?: string;
};

const USER_GUIDE = "/help/finances/user-guide";
const BOOKKEEPER_GUIDE = "/help/finances/bookkeeper-guide";

/** Content for the "How This Works" panel — plain data, no DB, so it ships
 * and updates like any other code change. Each entry mirrors a section of
 * one or both public guides (app/help/finances/*), which is what the
 * "Read the full guide" links deep-link into. */
export const HELP_CONTENT: Record<HelpKey, HelpEntry> = {
  overview: {
    title: "Overview",
    summary:
      "Your at-a-glance snapshot: cash on hand, this month's income and expenses, your most profitable project, a 12-month trend, and income/expense breakdowns by category.",
    tips: [
      "Pick any month with the date control to see that month's numbers instead of the current one",
      "The pie-chart breakdowns have their own independent date range",
      "The tax set-aside estimate (business books) is a planning number only — confirm the real figure with a CPA",
    ],
    guideLinks: [{ label: "Read the full guide", href: `${USER_GUIDE}#overview-dashboard` }],
  },
  projects: {
    title: "Projects",
    summary:
      "Track client jobs or gigs as Projects, then tag transactions and invoices to one to see its revenue, expenses, net profit, and margin computed automatically.",
    tips: [
      "Create a project before you start categorizing its transactions so nothing gets missed",
      "Project Comparison on the Reports tab ranks every project by net profit",
      "Archive a project when it wraps instead of deleting it, to keep its history",
    ],
    guideLinks: [{ label: "Read the full guide", href: `${USER_GUIDE}#projects` }],
  },
  transactions: {
    title: "Transactions",
    summary:
      "The ledger of everything moving through your accounts — synced from a connected bank, imported from a CSV, or added by hand — categorized into the accounts on your Chart of Accounts.",
    tips: [
      "Split a transaction across multiple categories if it covered more than one thing",
      "Set up a rule so a recurring payee categorizes itself from now on",
      "Try the sparkle-icon AI assistant to categorize a whole backlog from one plain-language instruction",
      "Flag anything you can't confidently categorize for the account owner to weigh in on",
    ],
    guideLinks: [
      { label: "User guide", href: `${USER_GUIDE}#everyday-transactions` },
      { label: "Bookkeeper guide", href: `${BOOKKEEPER_GUIDE}#categorization-at-scale` },
    ],
  },
  invoices: {
    title: "Invoices",
    summary:
      "Bill clients directly from Sage Studio. Record a payment against an invoice (in full or in part) and it posts to income and your chosen account automatically.",
    tips: [
      "Status moves itself through draft → sent → partial → paid as payments come in",
      "Link an invoice to a Project to fold it into that project's profitability",
    ],
    guideLinks: [{ label: "Read the full guide", href: `${USER_GUIDE}#invoicing-clients` }],
  },
  bills: {
    title: "Bills",
    summary:
      "The mirror of Invoices — money you owe instead of money owed to you. Log a vendor bill with its line items, then record payments against it as you pay.",
    tips: [
      "Each line item has its own category, so a single bill can hit several expense accounts at once",
      "A partial payment splits proportionally across every line item's category",
    ],
    guideLinks: [{ label: "Read the full guide", href: `${USER_GUIDE}#bills` }],
  },
  bank: {
    title: "Bank Accounts",
    summary:
      "Connect a bank via Plaid for automatic syncing, or add an account manually (cash, an unsupported bank, a hand-kept ledger) — either way it can be reconciled against a statement.",
    tips: [
      "Newly connected accounts need mapping to a category before they'll sync",
      "Rules here apply automatically to new transactions; use \"Apply to existing\" to sweep the backlog too",
      "The reconcile icon works the same for manual and Plaid-connected accounts",
    ],
    guideLinks: [
      { label: "User guide", href: `${USER_GUIDE}#everyday-transactions` },
      { label: "Bookkeeper guide", href: `${BOOKKEEPER_GUIDE}#reconciliation` },
    ],
  },
  reports: {
    title: "Reports",
    summary:
      "Income Statement, Balance Sheet, Trends, and Project Comparison — plus where to post a manual journal entry and export the full CPA package.",
    tips: [
      "Click any account row on the Income Statement to see and recategorize its transactions",
      "The Balance Sheet rolls current-year net income into equity automatically — no year-end closing entry needed",
      "Export CPA package bundles the trial balance and journal register too, not just the summarized reports",
    ],
    guideLinks: [{ label: "Bookkeeper guide", href: `${BOOKKEEPER_GUIDE}#reports` }],
  },
  accounts: {
    title: "Chart of Accounts",
    summary:
      "The categories everything gets sorted into — asset, liability, equity, income, or expense, each with a subtype used for grouping on reports.",
    tips: [
      "Archive an account instead of trying to delete one that already has history",
      "An archived account's past balances still report correctly, it just drops out of new category pickers",
    ],
    guideLinks: [{ label: "Bookkeeper guide", href: `${BOOKKEEPER_GUIDE}#chart-of-accounts` }],
  },
  activity: {
    title: "Activity",
    summary:
      "A read-only audit trail of who did what — every transaction, journal entry, account change, bill/invoice action, and period close/reopen, with an expandable diff.",
    tips: [
      "Use this to answer \"why did this change\" without asking around",
      "A collaborator's actions here are just as visible as the owner's — it's a two-way accountability tool",
    ],
    guideLinks: [{ label: "Bookkeeper guide", href: `${BOOKKEEPER_GUIDE}#audit-trail` }],
  },
  reconciliation: {
    title: "Bank reconciliation",
    summary:
      "Match your books against a real bank/credit-card statement. Check off everything that appears on the statement until the Difference reads exactly $0.00, then finish.",
    tips: [
      "There's no partial or forced finish — a nonzero difference means something's missing or miscategorized",
      "Finishing locks the journal entries behind every cleared transaction",
      "Only the most recent reconciliation on an account can be reopened, to keep history in order",
    ],
    guideLinks: [{ label: "Read the full guide", href: `${BOOKKEEPER_GUIDE}#reconciliation` }],
  },
  "journal-entry": {
    title: "Journal entries",
    summary:
      "A free-form debit/credit entry not tied to any bank transaction — the right tool for accruals, depreciation, and opening balances. Total debits must equal total credits.",
    tips: [
      "Add as many lines as needed with the + Add line button",
      "Deleting an entry posts a reversal rather than erasing it, so the audit trail stays intact",
    ],
    guideLinks: [{ label: "Read the full guide", href: `${BOOKKEEPER_GUIDE}#journal-entries` }],
  },
  "period-close": {
    title: "Closing the period",
    summary:
      "Owner-only: locks the entire ledger through a chosen date so nothing dated on or before it can change until deliberately reopened.",
    tips: [
      "Reconcile every account and check the reports before closing",
      "Reopening is all-or-nothing — there's no partial reopen to an earlier date",
      "Only the owner can close or reopen, even if a collaborator was invited as Manager",
    ],
    guideLinks: [{ label: "Read the full guide", href: `${BOOKKEEPER_GUIDE}#period-close` }],
  },
  collaborators: {
    title: "Sharing access",
    summary:
      "Invite a bookkeeper, accountant, or business partner by email with a role: Viewer (read-only), Editor (day-to-day bookkeeping), or Manager (Editor plus managing other collaborators).",
    tips: [
      "Editor is the right level for most bookkeepers",
      "Only the owner can rename/delete the books or close/reopen a period, regardless of anyone else's role",
    ],
    guideLinks: [
      { label: "User guide", href: `${USER_GUIDE}#inviting-a-bookkeeper` },
      { label: "Bookkeeper guide", href: `${BOOKKEEPER_GUIDE}#roles-and-access` },
    ],
  },
};
