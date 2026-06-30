import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { LayoutDashboard, UserPlus, Globe, Zap, MessageSquare, BrainCircuit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AiAccessTable, type UserRow } from "@/components/admin/AiAccessTable";

export const metadata: Metadata = { title: "Admin — Sage Studio" };

// ─── Metrics ────────────────────────────────────────────────────────────────

async function getMetrics() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: proUsers },
    { count: totalSites },
    { count: publishedSites },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("tier_key", "studio_pro"),
    supabase.from("artist_sites").select("*", { count: "exact", head: true }),
    supabase.from("artist_sites").select("*", { count: "exact", head: true }).eq("is_published", true),
  ]);

  let mrr = 0;
  try {
    const stripe = getStripe();
    const priceId = process.env.STRIPE_SAGE_STUDIO_PRICE_PRO!;
    const subs = await stripe.subscriptions.list({ price: priceId, status: "active", limit: 100 });
    mrr = subs.data.reduce((sum, sub) => {
      const item = sub.items.data.find((i) => i.price.id === priceId);
      return sum + (item?.price.unit_amount ?? 0) / 100;
    }, 0);
  } catch {
    mrr = (proUsers ?? 0) * 5;
  }

  return {
    totalUsers: totalUsers ?? 0,
    proUsers: proUsers ?? 0,
    totalSites: totalSites ?? 0,
    publishedSites: publishedSites ?? 0,
    mrr,
  };
}

// ─── Activity feed ───────────────────────────────────────────────────────────

type EventType = "user_joined" | "site_created" | "pro_upgrade" | "form_submission";

interface ActivityEvent {
  id: string;
  type: EventType;
  ts: string;
  label: string;
  sub?: string;
}

async function getActivityFeed(): Promise<ActivityEvent[]> {
  const supabase = await createClient();

  const [
    { data: users },
    { data: sites },
    { data: subs },
    { data: submissions },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("artist_sites")
      .select("id, name, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("subscriptions")
      .select("id, user_id, status, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(40),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("form_submissions")
      .select("id, site_slug, form_title, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  // Resolve profile names for site + subscription events
  const userIds = [
    ...(sites ?? []).map((s: { user_id: string }) => s.user_id),
    ...(subs ?? []).map((s: { user_id: string }) => s.user_id),
  ];
  const { data: profileRows } = userIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, username").in("id", [...new Set(userIds)])
    : { data: [] };
  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const events: ActivityEvent[] = [];

  for (const u of users ?? []) {
    events.push({
      id: `user-${u.id}`,
      type: "user_joined",
      ts: u.created_at,
      label: `${u.display_name ?? u.username ?? "Someone"} joined`,
    });
  }

  for (const s of sites ?? []) {
    const p = profileMap.get(s.user_id);
    events.push({
      id: `site-${s.id}`,
      type: "site_created",
      ts: s.created_at,
      label: `New site created: ${s.name}`,
      sub: p ? `by ${p.display_name ?? p.username}` : undefined,
    });
  }

  for (const sub of subs ?? []) {
    const p = profileMap.get(sub.user_id);
    events.push({
      id: `sub-${sub.id}`,
      type: "pro_upgrade",
      ts: sub.created_at,
      label: `${p?.display_name ?? p?.username ?? "Someone"} upgraded to Pro`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (submissions ?? []) as any[]) {
    events.push({
      id: `form-${s.id}`,
      type: "form_submission",
      ts: s.created_at,
      label: `Form submission on ${s.site_slug}`,
      sub: s.form_title ?? undefined,
    });
  }

  return events
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 80);
}

// ─── Components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1 text-[var(--foreground)]">{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground)] mt-1">{sub}</p>}
    </div>
  );
}

const EVENT_CONFIG: Record<EventType, { icon: React.ElementType; color: string }> = {
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
        {event.sub && (
          <p className="text-xs text-[var(--muted-foreground)]">{event.sub}</p>
        )}
      </div>
      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0 pt-0.5">
        {formatDistanceToNow(new Date(event.ts), { addSuffix: true })}
      </span>
    </div>
  );
}

// ─── AI access list ──────────────────────────────────────────────────────────

async function getAiAccessUsers(): Promise<UserRow[]> {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    admin.from("profiles").select("id, display_name, tier_key, ai_assistant_enabled").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailMap = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  return (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    email: emailMap.get(p.id) ?? "",
    tier_key: p.tier_key ?? "free",
    ai_assistant_enabled: p.ai_assistant_enabled ?? false,
  }));
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/my-site");

  const [m, feed, aiUsers] = await Promise.all([getMetrics(), getActivityFeed(), getAiAccessUsers()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard size={22} /> Platform Admin
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Sage Studio platform metrics.
        </p>
      </div>

      {/* Revenue */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Revenue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="MRR" value={`$${m.mrr.toFixed(0)}`} sub="Active Pro subscriptions" />
          <StatCard label="ARR" value={`$${(m.mrr * 12).toFixed(0)}`} sub="Annualised" />
          <StatCard label="Pro users" value={String(m.proUsers)} sub="$5/mo each" />
        </div>
      </section>

      {/* Users */}
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

      {/* Sites */}
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

      {/* AI Access */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">AI Assistant Access</h2>
          <BrainCircuit size={14} className="text-[var(--muted-foreground)]" />
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          Enable the AI page-editing assistant for specific accounts. Off by default. Click a row to toggle.
        </p>
        <AiAccessTable users={aiUsers} />
      </section>

      {/* Activity feed */}
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
