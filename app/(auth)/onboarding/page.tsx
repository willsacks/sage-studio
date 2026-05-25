"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Loader2 } from "lucide-react";
import { completeOnboarding } from "@/lib/actions/auth";

export default function OnboardingPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await completeOnboarding(displayName, username.toLowerCase().replace(/\s+/g, "-"));
    setLoading(false);
    if (result.success) {
      router.push("/my-site");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center gap-2 justify-center">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Leaf size={16} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Sage Studio</span>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Set up your profile</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Just a couple of things to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--foreground)]">Your name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mary Smith"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--primary)] transition-colors placeholder:text-[var(--muted-foreground)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--foreground)]">Username</label>
              <div className="flex items-center border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-[var(--primary)] transition-colors">
                <span className="px-3 py-2.5 text-xs text-[var(--muted-foreground)] bg-[var(--muted)] border-r border-[var(--border)]">
                  sagestudio.org/
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="your-name"
                  required
                  minLength={3}
                  className="flex-1 px-3 py-2.5 bg-[var(--background)] text-sm focus:outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Your artist site will live at this URL.
              </p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !displayName || !username}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Get started
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
