import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";

export const metadata: Metadata = { title: "Privacy Policy — Sage Studio" };

export default function PrivacyPolicyPage() {
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
          <h1 className="text-2xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Effective date: August 29, 2026</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">
            Sage Studio is built for artists and creators, and we think privacy is part of that mission. The short
            version: your work and your data are yours. We collect only what's needed to run the product, we never
            sell your data, and we give you real, working tools to see and delete what we hold — not just a promise
            buried in legal text.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Who We Are</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio ("we," "us") is a website builder and creative-business toolkit, including project
            management, a newsletter tool, and financial tracking for personal and business use. This policy explains
            what information we collect, why, and what rights you have over it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Information We Collect</h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              <strong className="text-[var(--foreground)]">Account information.</strong> Your name, email address, and
              profile details you choose to provide.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Content you create.</strong> Site pages, tasks, pipeline
              records, newsletter contacts, and financial data you enter or import — this is your content, and we
              treat it that way (see Section 6).
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Financial and transaction data.</strong> If you choose to
              connect a bank or credit card through Plaid, we receive transaction and account data (balances,
              transaction descriptions and amounts) from Plaid on your behalf, so you can categorize and report on
              it. We never receive or store your bank login credentials — those go directly to Plaid and your
              financial institution, never through our servers.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Payment information.</strong> If you subscribe to a paid
              plan, billing is handled by Stripe. We do not store your full card number.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">Usage information.</strong> Basic technical information
              (like IP address and browser type) needed to keep the service secure and working — for example, to
              rate-limit abuse on public forms. We do not use third-party advertising trackers or sell this
              information to anyone.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            We use your information only to operate and improve Sage Studio: to run the features you use, to send
            you service-related email (like a magic sign-in link, or a note from your own newsletter tool that you
            chose to send), to keep the platform secure, and to provide customer support. We do not use your content
            or financial data to train third-party AI models, and we do not sell, rent, or trade your personal
            information to anyone, ever.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Who We Share Information With</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            We share information only with the service providers necessary to run Sage Studio, each acting under
            their own confidentiality and security obligations: Supabase (database and authentication), Vercel
            (hosting), Plaid (bank connections, only if you choose to connect an account), Stripe (payment
            processing), and Resend (sending email you request, like magic links or your own newsletter sends). We
            do not share your data with data brokers, advertisers, or anyone else for marketing purposes. We may
            disclose information if legally required to (e.g. a valid court order), and we'll notify you first
            unless we're legally prohibited from doing so.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Your Rights and Choices</h2>
          <div className="space-y-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>Regardless of where you live, you can, at any time, directly within the product:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Disconnect any linked bank account — this immediately stops further data collection from it.</li>
              <li>Delete individual records, sites, projects, or your entire account.</li>
              <li>Revoke access you've granted to a collaborator (e.g. a bookkeeper) at any time.</li>
              <li>Request a copy of your data by contacting us (see Section 9).</li>
            </ul>
            <p>
              If you're in the EU, UK, California, or another jurisdiction with its own data protection law, you may
              have additional rights (such as data portability or the right to object to certain processing) — we
              honor these for all users, not just where legally required, because we think they're the right way to
              treat people's data.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Ownership of Your Content</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            You own everything you create in Sage Studio — your site content, your financial records, your contact
            lists. We don't claim any ownership over it, and we don't grant ourselves a broad license to reuse it
            beyond what's strictly needed to provide the service to you (for example, rendering your published site
            publicly, or generating a report from your own data). If you delete your account, your content is
            deleted with it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Data Security</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            We encrypt sensitive data (like bank access tokens) at rest, enforce HTTPS everywhere, and scope every
            user's data at the database level so it's only accessible to that user and anyone they've explicitly
            invited. Full details are in our{" "}
            <Link href="/security" className="text-[var(--primary)] hover:underline">Information Security Policy</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Data Retention</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            We keep your data for as long as your account is active, or as needed to provide the service. When you
            delete a record, a site, or your account, we delete the underlying data — we don't keep hidden copies
            around indefinitely. Some information may be retained briefly in backups or logs for security and
            operational reasons before it's fully purged.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Children's Privacy</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio is not directed at children under 13, and we do not knowingly collect personal information
            from children under 13. If you believe a child has provided us information, contact us and we'll delete
            it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Changes to This Policy</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            If we make a material change to how we handle your data, we'll update the effective date above and, for
            significant changes, notify you directly (e.g. by email).
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-semibold">11. Contact Us</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Questions about this policy, or want a copy or deletion of your data? Email us at{" "}
            <a href="mailto:will@fulcrumventures.org" className="text-[var(--primary)] hover:underline">will@fulcrumventures.org</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
