import { redirect } from "next/navigation";
import { CreditCard, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isProPlan } from "@/lib/plan-gates";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier_key, role")
    .eq("id", user.id)
    .single();

  const isPro = isProPlan(profile?.tier_key ?? "", profile?.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard size={22} /> Billing
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Manage your Sage Studio plan.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Free */}
        <div className={`rounded-2xl border p-6 space-y-4 ${!isPro ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Free</p>
              <p className="text-2xl font-bold mt-1">$0 <span className="text-sm font-normal text-[var(--muted-foreground)]">/ month</span></p>
            </div>
            {!isPro && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">Current plan</span>
            )}
          </div>
          <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
            {["1 artist site", "Up to 5 pages", "All themes & blocks", "Unlimited time tracking", "sagestudio.org subdomain"].map((f) => (
              <li key={f} className="flex items-center gap-2"><Check size={13} className="text-[var(--primary)] flex-shrink-0" />{f}</li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className={`rounded-2xl border p-6 space-y-4 ${isPro ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Pro</p>
              <p className="text-2xl font-bold mt-1">$5 <span className="text-sm font-normal text-[var(--muted-foreground)]">/ month</span></p>
            </div>
            {isPro && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">Current plan</span>
            )}
          </div>
          <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
            {["Everything in Free", "Custom domain", "Unlimited sites", "Unlimited pages", "Half of revenue goes to arts advocacy"].map((f) => (
              <li key={f} className="flex items-center gap-2"><Check size={13} className="text-[var(--primary)] flex-shrink-0" />{f}</li>
            ))}
          </ul>
          {!isPro && (
            <a
              href="/api/checkout?plan=pro"
              className="block text-center px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Upgrade to Pro
            </a>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        Half of all Pro revenue is donated to arts advocacy. Built by an artist, for artists.
      </p>
    </div>
  );
}
