"use client";

import { useState } from "react";
import Link from "next/link";
import { Leaf, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildCallbackUrl() {
    const next = new URLSearchParams(window.location.search).get("next");
    const url = `${window.location.origin}/api/auth/callback`;
    return next ? `${url}?next=${encodeURIComponent(next)}` : url;
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: buildCallbackUrl(),
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildCallbackUrl(),
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
    // On success Supabase redirects the browser automatically
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Leaf size={16} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Sage Studio</span>
        </Link>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 space-y-6">
          {sent ? (
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                We sent a magic link to <strong>{email}</strong>
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">Welcome to Sage Studio</h1>
                <p className="text-sm text-[var(--muted-foreground)]">Sign in or create a free account</p>
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm font-medium hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[var(--border)]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[var(--card)] px-2 text-[var(--muted-foreground)]">or</span>
                </div>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--primary)] transition-colors placeholder:text-[var(--muted-foreground)]"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  Send magic link
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          Free forever. No credit card required.
        </p>
      </div>
    </div>
  );
}
