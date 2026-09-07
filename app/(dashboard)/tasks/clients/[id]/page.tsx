import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format, startOfWeek, addWeeks } from "date-fns";
import { Building2, Clock, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatTime(iso: string) {
  return format(new Date(iso), "h:mm a");
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clientData } = await supabase
    .from("clients")
    .select("id, name, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!clientData) notFound();

  const { data: entriesRaw } = await supabase
    .from("time_entries")
    .select("id, description, started_at, stopped_at, duration_seconds, category")
    .eq("client_id", id)
    .eq("user_id", user.id)
    .not("stopped_at", "is", null)
    .order("started_at", { ascending: false });

  const entries = (entriesRaw ?? []) as {
    id: string;
    description: string;
    started_at: string;
    stopped_at: string;
    duration_seconds: number | null;
    category: string | null;
  }[];

  const totalSecs = entries.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  const sessionCount = entries.length;

  // Weekly bar chart: last 8 weeks
  const weeklyTotals: { label: string; seconds: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 });
    const weekEnd = addWeeks(weekStart, 1);
    const secs = entries
      .filter((e) => {
        const d = new Date(e.started_at);
        return d >= weekStart && d < weekEnd;
      })
      .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
    weeklyTotals.push({ label: format(weekStart, "MMM d"), seconds: secs });
  }
  const maxWeekSecs = Math.max(...weeklyTotals.map((w) => w.seconds), 1);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tasks"
          className="p-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-[var(--primary)]" />
            <h1 className="text-2xl font-bold">{clientData.name}</h1>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">Client time summary</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
            <Clock size={13} /> Total time
          </div>
          <p className="text-2xl font-bold font-mono">{formatDuration(totalSecs)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
            <Calendar size={13} /> Sessions
          </div>
          <p className="text-2xl font-bold">{sessionCount}</p>
        </div>
        {sessionCount > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
              <Clock size={13} /> Avg session
            </div>
            <p className="text-2xl font-bold font-mono">{formatDuration(Math.round(totalSecs / sessionCount))}</p>
          </div>
        )}
      </div>

      {/* Weekly chart */}
      {totalSecs > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-sm font-semibold mb-4">Weekly activity</h2>
          <div className="flex items-end gap-2 h-24">
            {weeklyTotals.map((w) => (
              <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "72px" }}>
                  <div
                    className="w-full bg-[var(--primary)] rounded-t-sm transition-all"
                    style={{ height: `${Math.round((w.seconds / maxWeekSecs) * 72)}px`, minHeight: w.seconds > 0 ? "2px" : "0" }}
                  />
                </div>
                <span className="text-[9px] text-[var(--muted-foreground)] text-center leading-tight">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entry log */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <Building2 size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No time entries for this client yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold">All sessions</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${
                    entry.description ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)] italic"
                  }`}>
                    {entry.description || "No description"}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {format(new Date(entry.started_at), "EEE, MMM d")} · {formatTime(entry.started_at)} – {formatTime(entry.stopped_at)}
                  </p>
                </div>
                <span className="font-mono text-sm font-medium text-[var(--foreground)] flex-shrink-0">
                  {entry.duration_seconds != null ? formatDuration(entry.duration_seconds) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
