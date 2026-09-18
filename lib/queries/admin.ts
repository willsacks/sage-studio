import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export interface PlatformMetrics {
  totalUsers: number;
  proUsers: number;
  totalSites: number;
  publishedSites: number;
  mrr: number;
}

export async function getMetrics(): Promise<PlatformMetrics> {
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

type EventType = "user_joined" | "site_created" | "pro_upgrade" | "form_submission";

export interface ActivityEvent {
  id: string;
  type: EventType;
  ts: string;
  label: string;
  sub?: string;
}

export async function getActivityFeed(): Promise<ActivityEvent[]> {
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

export type FinanceAiRun = {
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

export async function getFinanceAiRuns(): Promise<FinanceAiRun[]> {
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

export interface AdminUserRow {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string;
  role: string;
  tier_key: string;
  ai_assistant_enabled: boolean;
  ai_finance_assistant_enabled: boolean;
  created_at: string;
}

export async function getAllUsers(): Promise<AdminUserRow[]> {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    admin.from("profiles").select("id, display_name, username, role, tier_key, ai_assistant_enabled, ai_finance_assistant_enabled, created_at").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailMap = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  return (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    username: p.username,
    email: emailMap.get(p.id) ?? "",
    role: p.role ?? "member",
    tier_key: p.tier_key ?? "free",
    ai_assistant_enabled: p.ai_assistant_enabled ?? false,
    ai_finance_assistant_enabled: p.ai_finance_assistant_enabled ?? false,
    created_at: p.created_at,
  }));
}

export interface AdminUserDetail extends AdminUserRow {
  sites: { id: string; name: string; slug: string; is_published: boolean }[];
  ownedCourses: { id: string; title: string; status: string }[];
  enrolledCourses: { id: string; title: string; status: string }[];
  activeDiscountPercent: number | null;
}

/** Backs the customer-success "look up an account" view — read-only, no
 * write actions live here. */
export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, username, role, tier_key, ai_assistant_enabled, ai_finance_assistant_enabled, created_at, active_discount_percent")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  const [{ data: sites }, { data: ownedCourses }, { data: enrollments }] = await Promise.all([
    admin.from("artist_sites").select("id, name, slug, is_published").eq("user_id", userId),
    admin.from("courses").select("id, title, status").eq("owner_id", userId),
    admin.from("enrollments").select("course_id, courses(id, title, status)").eq("user_id", userId),
  ]);

  return {
    id: profile.id,
    display_name: profile.display_name,
    username: profile.username,
    email: authUser?.user?.email ?? "",
    role: profile.role ?? "member",
    tier_key: profile.tier_key ?? "free",
    ai_assistant_enabled: profile.ai_assistant_enabled ?? false,
    ai_finance_assistant_enabled: profile.ai_finance_assistant_enabled ?? false,
    created_at: profile.created_at,
    sites: sites ?? [],
    ownedCourses: ownedCourses ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enrolledCourses: ((enrollments ?? []) as any[]).map((e) => e.courses).filter(Boolean),
    activeDiscountPercent: profile.active_discount_percent,
  };
}
