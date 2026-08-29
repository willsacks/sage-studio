import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";

export const metadata: Metadata = { title: "Information Security Policy — Sage Studio" };

export default function SecurityPolicyPage() {
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
          <h1 className="text-2xl font-bold">Information Security Policy</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Effective date: August 29, 2026 · Reviewed annually</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Purpose and Scope</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            This policy describes how Sage Studio identifies, mitigates, and monitors information security risks
            relevant to the personal, business, and financial data it processes on behalf of its users. It applies to
            the Sage Studio web application, its underlying infrastructure, and the third-party service providers it
            relies on to deliver the product.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Organization and Responsibility</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio is a founder-led company. Information security responsibility — including this policy's
            maintenance, access-control decisions, incident response, and vendor risk review — is currently
            centralized with the founder, Will Sage. As the team grows, security responsibilities will be formally
            delegated and this policy updated accordingly.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Data We Handle</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio processes account information (name, email), user-generated content (site content, tasks,
            financial records the user enters), and, for users who connect a bank or credit card, transaction data
            and account metadata obtained through Plaid. Sage Studio never receives or stores bank account
            credentials directly — those are handled entirely within Plaid's own secure authentication flow.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Technical Controls</h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              <strong className="text-[var(--foreground)]">Encryption in transit.</strong> All traffic to and from
              Sage Studio is served over HTTPS/TLS. Our hosting provider (Vercel) and database provider (Supabase)
              enforce TLS for all connections.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Encryption at rest.</strong> Third-party access tokens and
              API keys stored on behalf of users — including Plaid bank access tokens — are encrypted at rest using
              AES-256-GCM before being written to the database. Different categories of secrets (e.g. bank access
              tokens vs. email-service API keys) use independently derived encryption keys, so that the exposure of
              one does not compromise the other.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Access control.</strong> Every user's data is scoped at
              the database level using Postgres Row Level Security, not just application-level checks — a user (or a
              collaborator they've explicitly invited, such as a bookkeeper) can only read or modify records they own
              or have been granted a specific role on (viewer, editor, or manager). Collaborator access is granted
              individually, by invitation, and can be revoked at any time.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Authentication.</strong> Sage Studio does not store user
              passwords. Authentication is handled by our identity provider (Supabase Auth) via passwordless
              email links and, optionally, third-party OAuth sign-in.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Webhook integrity.</strong> Inbound webhooks from
              financial data providers are cryptographically verified (signature/JWT validation against the
              provider's published verification keys) before any data is processed, to prevent forged requests.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Secrets management.</strong> API keys and encryption
              secrets are stored as encrypted environment variables in our hosting provider's secret store and are
              never committed to source control.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Secure Development Practices</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            All code changes are tracked in version control with a full history. Dependencies are regularly updated
            and checked for known vulnerabilities (`npm audit`) before release. Every deployment goes through an
            automated build and type-check step before reaching production, and security-relevant changes (access
            control, encryption, payment and financial data handling) receive a dedicated review pass before being
            shipped.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Third-Party Service Providers</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio relies on established infrastructure providers rather than operating its own servers or
            database hardware: Vercel (application hosting), Supabase (database and authentication), Plaid (bank
            connections), Stripe (payments), and Resend (transactional email). Each provider maintains its own
            independent security and compliance program. We select vendors that publish their own security
            documentation and review new integrations before granting them access to user data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Monitoring</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Application and infrastructure logs (via Vercel and Supabase) are reviewed when investigating reported
            issues or anomalies. Financial records maintain an audit trail of who created or modified them and when.
            As Sage Studio grows, this will be supplemented with automated alerting.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Data Retention and Deletion</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Users can disconnect a linked bank account at any time, which stops further data collection from that
            account. Users can delete their financial entities, sites, or account entirely; deletion cascades to
            remove associated records, including encrypted third-party tokens.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Incident Response</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            In the event of a suspected security incident, Sage Studio will: (1) contain the issue, including
            revoking affected credentials or access tokens, (2) assess what data may have been affected, (3) notify
            affected users and relevant partners without undue delay, and (4) remediate the underlying cause before
            restoring full service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Policy Review</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            This policy is reviewed at least annually, and whenever a material change is made to how Sage Studio
            handles user data or connects to new third-party services.
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
