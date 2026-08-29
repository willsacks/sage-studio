import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";

export const metadata: Metadata = { title: "Access Controls Policy — Sage Studio" };

export default function AccessControlsPolicyPage() {
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
          <h1 className="text-2xl font-bold">Access Controls Policy</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Effective date: April 1, 2026 · Reviewed annually</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Purpose and Scope</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            This policy describes the controls Sage Studio has in place to limit access to production systems and
            sensitive data, including user account data, financial data, and infrastructure credentials. It
            complements our{" "}
            <Link href="/security" className="text-[var(--primary)] hover:underline">Information Security Policy</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. No Physical Infrastructure</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio does not own or operate any physical servers or data center hardware. All production
            infrastructure runs on our hosting provider (Vercel) and database provider (Supabase), each of which
            maintains its own physical and data-center access controls as part of their respective security and
            compliance programs. There are no physical assets under Sage Studio's direct control to secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Access to Production Systems</h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              <strong className="text-[var(--foreground)]">Principle of least privilege.</strong> Production access is
              limited to the minimum set of individuals and credentials required to operate the service. As a
              founder-led company, production infrastructure access is currently held solely by the founder, Will
              Sage. There are no shared logins.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Provider-managed authentication.</strong> Access to
              production infrastructure (hosting, database, deployment pipeline) is gated by each provider's own
              account login, not a custom-built admin panel. Two-factor authentication is enabled on all accounts
              with production access, including our hosting provider, database provider, source control, and
              payment processor.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Separation of application and infrastructure access.</strong>{" "}
              End users and application-level administrators of Sage Studio never receive infrastructure-level
              access (e.g. database console access, hosting dashboard access) — those are entirely separate systems
              with separate credentials.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Access to Sensitive Data</h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              <strong className="text-[var(--foreground)]">Database-level enforcement, not just application logic.</strong>{" "}
              Every user's data is scoped at the database level using Postgres Row Level Security. This means access
              control is enforced by the database itself for every query, not solely by trusting the application
              code to filter results correctly. A user, or a collaborator they've explicitly invited (such as a
              bookkeeper), can only read or modify records they own or have been granted a specific role on (viewer,
              editor, or manager).
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Least-privilege service credentials.</strong> The
              application uses two distinct classes of database credential: a user-scoped key, used for all
              standard requests, which is always subject to Row Level Security; and a separate elevated
              service-role key, used only in a small set of trusted server-side code paths that must bypass Row
              Level Security (for example, background jobs and administrative operations). The elevated key is
              never exposed to the browser or any client-side code.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">User-granted, revocable collaborator access.</strong>{" "}
              Sensitive data — including financial records — is never shared with a third party by default.
              Collaborator access (e.g. inviting a bookkeeper to a set of books) is opt-in, scoped to a specific
              role, and revocable by the data owner at any time.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">No standing access to third-party financial credentials.</strong>{" "}
              Sage Studio never receives or stores bank account login credentials. Bank connection tokens (via
              Plaid) are encrypted at rest with AES-256-GCM and are only decrypted transiently, server-side, to make
              an authorized API call on the user's behalf.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Secrets and Credential Management</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            API keys and encryption secrets are stored only as encrypted environment variables in our hosting
            provider's secret store. They are never committed to source control, never logged, and never exposed to
            the client. Production secrets are scoped separately from any test or sandbox credentials.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Source Control Access</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Application source code is held in a private, access-controlled repository. Deployment to production
            only occurs through an automated build and type-check pipeline triggered by a change to the main
            branch — there is no manual or out-of-band path to modify production code.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Access Review</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            As Sage Studio is currently a single-administrator organization, there is no multi-person access list to
            review. As the team grows, this policy will be updated to include periodic (at minimum annual) review of
            everyone with production or sensitive-data access, and prompt revocation of access when no longer
            needed (e.g. role change or departure).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Policy Review</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            This policy is reviewed at least annually, and whenever a material change is made to who has access to
            production systems or how that access is granted.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Questions about this policy or to report a security concern: <a href="mailto:will@fulcrumventures.org" className="text-[var(--primary)] hover:underline">will@fulcrumventures.org</a>
          </p>
        </section>
      </main>
    </div>
  );
}
