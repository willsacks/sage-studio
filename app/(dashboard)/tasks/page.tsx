import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Timer } from "lucide-react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { TimerBar, type ActiveEntry } from "@/components/tasks/TimerBar";
import { EditableTimeEntry } from "@/components/tasks/EditableTimeEntry";
import { CategoryBreakdown } from "@/components/tasks/CategoryBreakdown";

export const metadata: Metadata = { title: "Time Tracker" };

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d");
}

function totalSeconds(entries: { duration_seconds: number | null }[]) {
  return entries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);
}

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch active (running) entry
  const { data: activeRaw } = await supabase
    .from("time_entries")
    .select("id, description, started_at, category")
    .eq("user_id", user.id)
    .is("stopped_at", null)
    .maybeSingle();

  const activeEntry: ActiveEntry | null = activeRaw ?? null;

  // Fetch completed entries (last 30 days)
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: entriesRaw } = await supabase
    .from("time_entries")
    .select("id, description, started_at, stopped_at, duration_seconds, category")
    .eq("user_id", user.id)
    .not("stopped_at", "is", null)
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false });

  const entries = (entriesRaw ?? []) as {
    id: string;
    description: string;
    started_at: string;
    stopped_at: string;
    duration_seconds: number | null;
    category: string | null;
  }[];

  // Group by calendar day
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = startOfDay(new Date(entry.started_at)).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Timer size={22} /> Time Tracker
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Track time on your creative work.
        </p>
      </div>

      <TimerBar activeEntry={activeEntry} />

      {entries.length > 0 && (
        <CategoryBreakdown entries={entries} />
      )}

      {groups.size === 0 && !activeEntry ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <Timer size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No entries yet. Start your first timer above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([key, dayEntries]) => {
            const dayDate = new Date(key);
            const dayTotal = totalSeconds(dayEntries);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[var(--border)]">
                  <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    {dayLabel(dayDate)}
                  </span>
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">
                    {formatDuration(dayTotal)} total
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEntries.map((entry) => (
                    <EditableTimeEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
