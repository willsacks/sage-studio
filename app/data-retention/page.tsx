import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";

export const metadata: Metadata = { title: "Data Retention and Disposal Policy — Sage Studio" };

export default function DataRetentionPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Leaf size={15} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="font-semibold tracking-tight">Sage Studio</span>
        </Link>
        <Link href="/" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
          Home
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 pb-24 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Data Retention and Disposal Policy</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Effective date: April 1, 2026 · Reviewed annually</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Purpose and Scope</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            This policy describes how long Sage Studio retains personal, business, and financial data, and how that
            data is disposed of when it is no longer needed. It applies to all data processed by the Sage Studio
            application, including data obtained from third-party providers such as Plaid. It complements our{" "}
            <Link href="/privacy" className="text-[var(--primary)] hover:underline">Privacy Policy</Link> and{" "}
            <Link href="/security" className="text-[var(--primary)] hover:underline">Information Security Policy</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Retention Principle</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio follows a data-minimization approach: data is retained only for as long as it is needed to
            provide the service to an active account, or as needed to meet a legal or operational obligation. We do
            not retain data indefinitely "just in case," and we do not keep hidden copies of deleted data outside of
            short-lived backups described in Section 5.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Retention Periods by Data Type</h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              <strong className="text-[var(--foreground)]">Account information</strong> (name, email, profile
              details) is retained for the life of the account and deleted upon account deletion.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">User-generated content</strong> (site content, tasks,
              pipeline records, newsletter contacts, financial records entered or imported by the user) is retained
              for the life of the associated account, site, or financial entity, and deleted when the user deletes
              that record, site, or entity, or their account.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Bank connection tokens and financial transaction data
              obtained via Plaid</strong> are retained only while a bank connection remains active. Disconnecting a
              linked account immediately stops further data collection; the encrypted access token and associated
              account metadata are deleted at that time. Historical transaction data already imported into the
              user's ledger is retained as part of the user's own financial records (Section 3, second item above)
              unless the user deletes it directly.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Payment information.</strong> Sage Studio does not store
              full card numbers; billing and payment data is held by our payment processor (Stripe) under its own
              retention policy.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Authentication data.</strong> Sage Studio does not store
              passwords. Sign-in is passwordless (magic link) or via third-party OAuth, managed by our identity
              provider (Supabase Auth). Session and authentication logs are retained only as long as operationally
              necessary for security purposes.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Usage and technical logs</strong> (e.g. application and
              infrastructure logs used to investigate reported issues) are retained for a limited operational
              window, consistent with our hosting and database providers' default log retention, and are not kept
              indefinitely.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Disposal Method</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            When a user deletes a record, a site, a financial entity, or their account, deletion is performed
            through the application's data layer and cascades to remove all associated records — this is enforced
            technically as part of the account/entity/site deletion process, not a manual step someone has to
            remember to perform. This includes encrypted third-party tokens (such as Plaid access tokens), which
            are deleted, not merely deactivated. Underlying storage is managed by our database provider (Supabase),
            which handles secure disposal of storage media at the infrastructure level as part of its own security
            program.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Backups</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Routine database backups, maintained by our database provider for disaster-recovery purposes, may
            briefly retain deleted data until the backup naturally rolls off per the provider's standard backup
            retention window. Backups are not used for any purpose other than restoring service in the event of a
            failure, and are not separately queried or exported.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Legal Holds and Exceptions</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            If Sage Studio is required to retain specific data beyond its normal retention period to comply with a
            legal obligation (such as a valid court order or a legally mandated financial record-keeping
            requirement), that data will be retained only for as long as required by that obligation, and only for
            the specific records covered by it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Policy Review</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            This policy is reviewed at least annually, and whenever a material change is made to how Sage Studio
            collects, retains, or disposes of user data.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Questions about this policy, or to request deletion of your data: <a href="mailto:will@fulcrumventures.org" className="text-[var(--primary)] hover:underline">will@fulcrumventures.org</a>
          </p>
        </section>
      </main>
    </div>
  );
}
