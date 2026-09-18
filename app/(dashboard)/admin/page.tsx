import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LayoutDashboard, UserPlus, Globe, Zap, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { canManagePlatform } from "@/lib/access/platform-access";
import { getMetrics, getActivityFeed, type ActivityEvent } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Admin — Sage Studio" };

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1 text-[var(--foreground)]">{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground)] mt-1">{sub}</p>}
    </div>
  );
}

const EVENT_CONFIG: Record<ActivityEvent["type"], { icon: React.ElementType; color: string }> = {
  user_joined:     { icon: UserPlus,       color: "text-blue-500 bg-blue-50" },
  site_created:    { icon: Globe,          color: "text-emerald-500 bg-emerald-50" },
  pro_upgrade:     { icon: Zap,            color: "text-amber-500 bg-amber-50" },
  form_submission: { icon: MessageSquare,  color: "text-purple-500 bg-purple-50" },
};

function FeedEvent({ event }: { event: ActivityEvent }) {
  const { icon: Icon, color } = EVENT_CONFIG[event.type];
  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--foreground)]">{event.label}</p>
        {event.sub && <p className="text-xs text-[var(--muted-foreground)]">{event.sub}</p>}
      </div>
      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0 pt-0.5">
        {formatDistanceToNow(new Date(event.ts), { addSuffix: true })}
      </span>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  // customer_success has no use for platform-wide revenue metrics — their
  // job is per-account lookups, so they land on Users instead.
  if (!canManagePlatform(profile?.role)) redirect("/admin/users");

  const [m, feed] = await Promise.all([getMetrics(), getActivityFeed()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard size={22} /> Platform Admin
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">Sage Studio platform metrics.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Revenue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="MRR" value={`$${m.mrr.toFixed(0)}`} sub="Active Pro subscriptions" />
          <StatCard label="ARR" value={`$${(m.mrr * 12).toFixed(0)}`} sub="Annualised" />
          <StatCard label="Pro users" value={String(m.proUsers)} sub="$5/mo each" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Users</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Total users" value={String(m.totalUsers)} />
          <StatCard label="Free users" value={String(m.totalUsers - m.proUsers)} sub="No subscription" />
          <StatCard
            label="Conversion"
            value={m.totalUsers > 0 ? `${((m.proUsers / m.totalUsers) * 100).toFixed(1)}%` : "—"}
            sub="Free → Pro"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Websites</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Sites created" value={String(m.totalSites)} />
          <StatCard
            label="Published"
            value={String(m.publishedSites)}
            sub={m.totalSites > 0 ? `${((m.publishedSites / m.totalSites) * 100).toFixed(0)}% of all sites` : undefined}
          />
          <StatCard label="Drafts" value={String(m.totalSites - m.publishedSites)} sub="Unpublished" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Activity</h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] px-4">
          {feed.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">No activity yet.</p>
          ) : (
            feed.map((event) => <FeedEvent key={event.id} event={event} />)
          )}
        </div>
      </section>
    </div>
  );
}
