import Link from "next/link";
import { Leaf, Globe, Timer, Check, ArrowRight, Heart } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Nav */}
      <header className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Leaf size={15} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="font-semibold tracking-tight">Sage Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)] text-[var(--primary)] text-xs font-medium mb-8">
          <Heart size={11} fill="currentColor" />
          Half of Pro profits go to arts advocacy organizations
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
          Free tools for artists{" "}
          <span className="text-[var(--primary)]">built by artists.</span>
        </h1>
        <p className="mt-6 text-lg text-[var(--muted-foreground)] max-w-xl mx-auto leading-relaxed">
          Build your artist website, track your creative time, and publish your work — free, forever. No credit card, no catch.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90 transition-opacity"
          >
            Create your free site <ArrowRight size={16} />
          </Link>
          <a
            href="#features"
            className="px-6 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            See what's included
          </a>
        </div>
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">Free forever. Upgrade to Pro for $5/month to use your own domain.</p>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 space-y-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--accent)] flex items-center justify-center">
              <Globe size={20} className="text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Artist website builder</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Build a beautiful portfolio site in minutes. Choose from hand-crafted themes, add your work, write your story. Publish at your own subdomain — or bring your own domain on Pro.
              </p>
            </div>
            <ul className="space-y-1.5">
              {["Beautiful themes designed for artists", "Home, About, Work, and custom pages", "Embed music, video, and images", "Offer pages built right in"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Check size={13} className="text-[var(--primary)] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 space-y-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--accent)] flex items-center justify-center">
              <Timer size={20} className="text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Creative time tracker</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Track how you spend your creative hours. Start a timer, tag it to a project or category, and see where your time is actually going — across days, weeks, and months.
              </p>
            </div>
            <ul className="space-y-1.5">
              {["One-click start/stop timer", "Tag time by project or category", "'Where your time went' breakdown", "Edit past entries anytime"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Check size={13} className="text-[var(--primary)] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Simple pricing</h2>
          <p className="text-[var(--muted-foreground)] mt-2">Unreasonable value for free. Pay only when you're serious.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 space-y-6">
            <div>
              <p className="font-semibold">Free</p>
              <p className="text-4xl font-bold mt-2">$0 <span className="text-base font-normal text-[var(--muted-foreground)]">/ month</span></p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Forever. No credit card.</p>
            </div>
            <ul className="space-y-2">
              {["1 artist site", "Up to 5 pages", "All themes & blocks", "Unlimited time tracking", "sagestudio.org subdomain"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Check size={13} className="text-[var(--primary)] flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block text-center px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
            >
              Get started free
            </Link>
          </div>

          <div className="rounded-2xl border-2 border-[var(--primary)] bg-[var(--card)] p-8 space-y-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold">
                Most popular
              </span>
            </div>
            <div>
              <p className="font-semibold">Pro</p>
              <p className="text-4xl font-bold mt-2">$5 <span className="text-base font-normal text-[var(--muted-foreground)]">/ month</span></p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Half of profits go to arts advocacy organizations.</p>
            </div>
            <ul className="space-y-2">
              {["Everything in Free", "Custom domain", "Unlimited sites", "Unlimited pages", "Support an arts advocate"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Check size={13} className="text-[var(--primary)] flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block text-center px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start with Pro
            </Link>
          </div>
        </div>
      </section>

      {/* Charity note */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-2xl bg-[var(--accent)] border border-[var(--primary)]/20 p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mx-auto">
            <Heart size={18} className="text-[var(--primary)]" fill="currentColor" />
          </div>
          <h3 className="font-semibold text-lg">Artists helping artists</h3>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto leading-relaxed">
            Sage Studio was built by Will Sage — musician, producer, creator. Half of every Pro subscription's profits go to arts advocacy organizations fighting to keep the arts alive and accessible.
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Interested in joining Creator Circle, Will's artist accountability community?{" "}
            <a href="https://creatorscircle.art" className="text-[var(--primary)] hover:underline">
              Learn more →
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <Leaf size={11} className="text-[var(--primary-foreground)]" />
            </div>
            <span className="text-sm font-medium">Sage Studio</span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Free tools for artists. Built by{" "}
            <a href="https://creatorscircle.art" className="hover:underline">Will Sage</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
