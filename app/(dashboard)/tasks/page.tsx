"use client";

import { useState, useEffect, useCallback } from "react";
import { Timer } from "lucide-react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { TimerBar, type ActiveEntry } from "@/components/tasks/TimerBar";
import { EditableTimeEntry } from "@/components/tasks/EditableTimeEntry";
import { CategoryBreakdown } from "@/components/tasks/CategoryBreakdown";
import type { ClientOption } from "@/components/tasks/CategoryPicker";
import { createClient } from "@/lib/supabase/client";

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

function effectiveSecs(e: { duration_seconds: number | null; started_at: string; stopped_at: string }) {
  if (e.duration_seconds != null && e.duration_seconds > 0) return e.duration_seconds;
  return Math.max(0, Math.floor((new Date(e.stopped_at).getTime() - new Date(e.started_at).getTime()) / 1000));
}

function totalSeconds(entries: { duration_seconds: number | null; started_at: string; stopped_at: string }[]) {
  return entries.reduce((sum, e) => sum + effectiveSecs(e), 0);
}

type Entry = {
  id: string;
  description: string;
  started_at: string;
  stopped_at: string;
  duration_seconds: number | null;
  category: string | null;
  client_id: string | null;
  client_name?: string | null;
};

export default function TasksPage() {
  const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const [activeRes, entriesRes, clientsRes] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id, description, started_at, category, client_id")
        .is("stopped_at", null)
        .maybeSingle(),
      supabase
        .from("time_entries")
        .select("id, description, started_at, stopped_at, duration_seconds, category, client_id")
        .not("stopped_at", "is", null)
        .gte("started_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order("started_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);

    const clientList = (clientsRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
    const clientMap = new Map(clientList.map((c) => [c.id, c.name]));

    setActiveEntry(activeRes.data ?? null);
    setClients(clientList);

    const rawEntries = (entriesRes.data ?? []) as Array<{
      id: string;
      description: string;
      started_at: string;
      stopped_at: string;
      duration_seconds: number | null;
      category: string | null;
      client_id: string | null;
    }>;
    setEntries(rawEntries.map((e) => ({
      ...e,
      client_name: e.client_id ? (clientMap.get(e.client_id) ?? null) : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleClientCreated(client: ClientOption) {
    setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
  }

  // Group by calendar day
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = startOfDay(new Date(entry.started_at)).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer size={22} /> Time Tracker
          </h1>
        </div>
        <div className="h-16 rounded-2xl bg-[var(--card)] border border-[var(--border)] animate-pulse" />
      </div>
    );
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

      <TimerBar
        activeEntry={activeEntry}
        clients={clients}
        onClientCreated={handleClientCreated}
        onMutated={loadData}
      />

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
                    <EditableTimeEntry
                      key={entry.id}
                      entry={entry}
                      clients={clients}
                      onClientCreated={handleClientCreated}
                      onMutated={loadData}
                    />
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
