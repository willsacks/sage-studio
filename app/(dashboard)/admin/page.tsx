import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import Link from "next/link";
import { LayoutDashboard, UserPlus, Globe, Zap, MessageSquare, BrainCircuit, ShieldCheck, FileText, Lock, KeyRound, Trash2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AiAccessTable, type UserRow } from "@/components/admin/AiAccessTable";
import { AiPromptEditor } from "@/components/admin/AiPromptEditor";
import { AiModelSelector } from "@/components/admin/AiModelSelector";
import { getAiPrompts, getAiModel } from "@/lib/actions/admin";
import { DEFAULT_SYSTEM_BLOCK, DEFAULT_SYSTEM_HTML } from "@/lib/ai/prompts";

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

const RUN_STATUS_STYLES: Record<FinanceAiRun["status"], string> = {
  completed: "bg-green-500/10 text-green-600",
  error: "bg-red-500/10 text-red-600",
  running: "bg-amber-500/10 text-amber-600",
};

function FinanceAiRunRow({ run }: { run: FinanceAiRun }) {
  // A "running" row whose start is more than a few minutes old never
  // reached completed/error — the actual signature of a hung/stalled run
  // (the thing this log exists to catch), so it's called out distinctly
  // from a run that's merely in flight right now.
  const ageMs = Date.now() - new Date(run.started_at).getTime();
  const likelyStalled = run.status === "running" && ageMs > 5 * 60 * 1000;

  return (
    <div className="py-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${RUN_STATUS_STYLES[run.status]}`}>
          {likelyStalled ? "stalled" : run.status}
        </span>
        <span className="text-sm font-medium">{run.entity_name}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{run.user_email}</span>
        <span className="text-xs text-[var(--muted-foreground)] ml-auto">
          {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })} · {run.turns} turn{run.turns === 1 ? "" : "s"} · {run.actions_taken} action{run.actions_taken === 1 ? "" : "s"}
          {run.stop_reason && ` · stop: ${run.stop_reason}`}
        </span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] truncate" title={run.message}>{run.message}</p>
      {run.error && <p className="text-xs text-red-500">{run.error}</p>}
    </div>
  );
}

// ─── AI access list ──────────────────────────────────────────────────────────

// ─── Finance AI run log ─────────────────────────────────────────────────────

type FinanceAiRun = {
  id: string;
  entity_name: string;
  user_email: string;
  message: string;
  started_at: string;
  finished_at: string | null;
  turns: number;
  stop_reason: string | null;
  status: "running" | "completed" | "error";
  error: string | null;
  actions_taken: number;
};

/** Recent AI categorization assistant runs — the durable trace added
 * alongside the run-progress fixes, so "it started working then stopped
 * responding" is diagnosable after the fact instead of only in the moment
 * (the live NDJSON stream to the browser is the only other record, and it's
 * gone as soon as the tab backgrounds or closes). A `status: "running"` row
 * whose `started_at` is more than a few minutes old is itself a signal —
 * that run never reached a normal completed/error state. */
async function getFinanceAiRuns(): Promise<FinanceAiRun[]> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("finance_ai_categorize_runs")
    .select("id, message, started_at, finished_at, turns, stop_reason, status, error, actions_taken, finance_entities(name), profiles(username, display_name)")
    .order("started_at", { ascending: false })
    .limit(20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    entity_name: r.finance_entities?.name ?? "Unknown entity",
    user_email: r.profiles?.display_name ?? r.profiles?.username ?? "Unknown user",
    message: r.message,
    started_at: r.started_at,
    finished_at: r.finished_at,
    turns: r.turns,
    stop_reason: r.stop_reason,
    status: r.status,
    error: r.error,
    actions_taken: r.actions_taken,
  }));
}

async function getAiAccessUsers(): Promise<UserRow[]> {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    admin.from("profiles").select("id, display_name, tier_key, ai_assistant_enabled, ai_finance_assistant_enabled").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailMap = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  return (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    email: emailMap.get(p.id) ?? "",
    tier_key: p.tier_key ?? "free",
    ai_assistant_enabled: p.ai_assistant_enabled ?? false,
    ai_finance_assistant_enabled: p.ai_finance_assistant_enabled ?? false,
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

  const [m, feed, aiUsers, aiPrompts, aiModel, financeAiRuns] = await Promise.all([getMetrics(), getActivityFeed(), getAiAccessUsers(), getAiPrompts(), getAiModel(), getFinanceAiRuns()]);

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

      {/* Legal & Compliance */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Legal & Compliance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { href: "/security", label: "Security Policy", icon: ShieldCheck },
            { href: "/access-controls", label: "Access Controls Policy", icon: KeyRound },
            { href: "/data-retention", label: "Data Retention Policy", icon: Trash2 },
            { href: "/privacy", label: "Privacy Policy", icon: Lock },
            { href: "/terms", label: "Terms of Service", icon: FileText },
          ].map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--accent)] transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <doc.icon size={15} className="text-[var(--muted-foreground)]" />
                {doc.label}
              </span>
              <ExternalLink size={13} className="text-[var(--muted-foreground)]" />
            </Link>
          ))}
        </div>
      </section>

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

      {/* AI Model */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">AI Assistant Model</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Which Claude model the AI assistant uses when editing pages. Takes effect on the next AI request, no deploy needed.
        </p>
        <AiModelSelector currentModel={aiModel} />
      </section>

      {/* AI Prompt */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">AI Assistant Prompt</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          The system prompt the AI assistant uses when editing pages — one for the block editor, one for the HTML editor. Edits take effect on the next AI request, no deploy needed.
        </p>
        <AiPromptEditor
          initialBlockPrompt={aiPrompts.blockPrompt}
          initialHtmlPrompt={aiPrompts.htmlPrompt}
          defaultBlockPrompt={DEFAULT_SYSTEM_BLOCK}
          defaultHtmlPrompt={DEFAULT_SYSTEM_HTML}
        />
      </section>

      {/* Finance AI runs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Finance AI Categorization Runs</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Last 20 runs of the Transactions-tab AI assistant — for tracing a run that stalled or errored (e.g. a stream that stopped responding), independent of what the browser that triggered it saw.
        </p>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] px-4">
          {financeAiRuns.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">No runs yet.</p>
          ) : (
            financeAiRuns.map((run) => <FinanceAiRunRow key={run.id} run={run} />)
          )}
        </div>
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
