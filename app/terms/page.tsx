import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";

export const metadata: Metadata = { title: "Terms of Service — Sage Studio" };

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold">Terms of Service</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Effective date: August 29, 2026</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">
            We've tried to write these in plain language and keep them fair to you, the person actually using the
            product. By using Sage Studio, you agree to these terms.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. What Sage Studio Is</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio is a website builder and set of creative-business tools — including project/task management,
            a newsletter tool, and a personal/business finance tracker — built for independent artists and creators.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Your Account</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            You need an account to use Sage Studio. You're responsible for keeping your login secure and for
            activity that happens under your account. You must be at least 18, or the age of majority in your
            jurisdiction, to create an account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Your Content, Your Ownership</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            You retain full ownership of everything you create or upload — your site content, images, financial
            records, contact lists, and anything else. We only use it to operate the service on your behalf (for
            example, publishing your site publicly when you ask us to, or generating a report from your own
            transactions). We don't license your content to third parties, and we don't use it to train AI models.
            You're responsible for making sure you have the rights to any content you upload.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Connecting Bank Accounts and Financial Data</h2>
          <div className="space-y-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              Sage Studio's Finances feature lets you optionally connect bank and credit card accounts through Plaid,
              a third-party financial data provider, and lets you enter or import transactions manually. This is
              provided to help you organize and understand your own financial records.
            </p>
            <p>
              <strong className="text-[var(--foreground)]">
                Sage Studio is not a bank, is not a registered investment or tax advisor, and nothing in the product
                (including any estimated tax set-aside figures, reports, or summaries) constitutes financial, tax,
                accounting, or legal advice.
              </strong>{" "}
              Always confirm your specific tax and financial obligations with a qualified professional. You are
              solely responsible for the accuracy of financial records you enter or categorize, and for any
              decisions you make based on information in the product.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Acceptable Use</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Please don't use Sage Studio to publish illegal content, infringe someone else's rights, distribute
            malware, harass others, or attempt to interfere with the security or normal operation of the service. We
            may suspend or terminate accounts that violate this, but we'll always try to warn you and give you a
            chance to export your data first, except in cases of serious abuse or legal risk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Subscriptions and Billing</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Some features require a paid plan, billed through Stripe. You can cancel a paid subscription at any time
            from your billing settings, effective at the end of your current billing period — we don't lock you into
            long-term contracts or make cancellation hard to find.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Third-Party Services</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio relies on third-party services (including Plaid, Stripe, Supabase, Vercel, and Resend) to
            provide certain features. Your use of those features is also subject to those providers' own terms.
            We're not responsible for outages or issues originating from a third-party provider, though we'll always
            be transparent with you about what's happening and why.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Ending Your Account</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            You can delete your account at any time, which deletes your data as described in our{" "}
            <Link href="/privacy" className="text-[var(--primary)] hover:underline">Privacy Policy</Link>. We may
            suspend or terminate an account for a genuine violation of these terms, but we'll give you notice and a
            reasonable opportunity to export your data first whenever possible.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Service "As Is" and Limitation of Liability</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Sage Studio is provided "as is." We work hard to keep it reliable and secure, but we can't guarantee it
            will always be available or error-free. To the extent permitted by law, Sage Studio isn't liable for
            indirect or consequential damages arising from your use of the service. Nothing in this section limits
            liability for something we couldn't legally limit, like our own gross negligence or willful misconduct.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Changes to These Terms</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            If we make a material change to these terms, we'll update the effective date above and, for significant
            changes, notify you directly.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">11. Governing Law</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            These terms are governed by the laws of the State of Tennessee, USA, without regard to conflict-of-law
            principles.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-semibold">12. Contact Us</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Questions about these terms? Email us at{" "}
            <a href="mailto:will@fulcrumventures.org" className="text-[var(--primary)] hover:underline">will@fulcrumventures.org</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
