"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Building2, ChevronDown } from "lucide-react";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, subDays, subMonths, subQuarters, subYears } from "date-fns";

interface Entry {
  duration_seconds: number | null;
  category: string | null;
  client_id: string | null;
  client_name?: string | null;
  started_at: string;
}

interface CategoryBreakdownProps {
  entries: Entry[];
}

type PeriodKey = "7d" | "30d" | "90d" | "this_week" | "this_month" | "this_quarter" | "this_year" | "all";

interface Period {
  label: string;
  key: PeriodKey;
}

const PERIODS: Period[] = [
  { label: "Last 7 days", key: "7d" },
  { label: "Last 30 days", key: "30d" },
  { label: "Last 90 days", key: "90d" },
  { label: "This week", key: "this_week" },
  { label: "This month", key: "this_month" },
  { label: "This quarter", key: "this_quarter" },
  { label: "This year", key: "this_year" },
  { label: "All time", key: "all" },
];

function getCutoff(key: PeriodKey): Date | null {
  const now = new Date();
  switch (key) {
    case "7d":          return subDays(now, 7);
    case "30d":         return subDays(now, 30);
    case "90d":         return subDays(now, 90);
    case "this_week":   return startOfWeek(now, { weekStartsOn: 1 });
    case "this_month":  return startOfMonth(now);
    case "this_quarter":return startOfQuarter(now);
    case "this_year":   return startOfYear(now);
    case "all":         return null;
  }
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

export function CategoryBreakdown({ entries }: CategoryBreakdownProps) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const cutoff = getCutoff(period);
    if (!cutoff) return entries;
    return entries.filter((e) => new Date(e.started_at) >= cutoff);
  }, [entries, period]);

  const totals = useMemo(() => {
    const map = new Map<string, { label: string; seconds: number; clientId?: string }>();
    for (const entry of filtered) {
      const secs = entry.duration_seconds ?? 0;
      if (secs === 0 || secs > 86400) continue;
      if (entry.client_id) {
        const key = `client:${entry.client_id}`;
        const label = entry.client_name ?? "Client";
        const existing = map.get(key);
        if (existing) existing.seconds += secs;
        else map.set(key, { label, seconds: secs, clientId: entry.client_id });
      } else {
        const key = entry.category ?? "uncategorised";
        const label = entry.category ?? "Uncategorised";
        const existing = map.get(key);
        if (existing) existing.seconds += secs;
        else map.set(key, { label, seconds: secs });
      }
    }
    return map;
  }, [filtered]);

  if (totals.size === 0) return null;

  const sorted = Array.from(totals.values()).sort((a, b) => b.seconds - a.seconds);
  const maxSeconds = sorted[0].seconds;
  const totalAll = sorted.reduce((s, c) => s + c.seconds, 0);
  const selectedPeriod = PERIODS.find((p) => p.key === period)!;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Where your time went</h2>

        {/* Period selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            {selectedPeriod.label}
            <ChevronDown size={11} />
          </button>
          {open && (
            <div
              className="absolute right-0 top-full mt-1 w-40 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden"
              onMouseLeave={() => setOpen(false)}
            >
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { setPeriod(p.key); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--accent)] transition-colors ${
                    p.key === period ? "text-[var(--primary)] font-medium" : "text-[var(--foreground)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((cat) => {
          const pct = Math.round((cat.seconds / totalAll) * 100);
          const barWidth = Math.round((cat.seconds / maxSeconds) * 100);
          return (
            <div key={cat.label + (cat.clientId ?? "")} className="flex items-center gap-2 sm:gap-3">
              <div className="w-24 sm:w-32 flex-shrink-0">
                {cat.clientId ? (
                  <Link
                    href={`/tasks/clients/${cat.clientId}`}
                    className="text-xs text-[var(--foreground)] truncate flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
                  >
                    <Building2 size={10} className="flex-shrink-0" />
                    {cat.label}
                  </Link>
                ) : (
                  <span className="text-xs text-[var(--foreground)] truncate block">{cat.label}</span>
                )}
              </div>
              <div className="flex-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)] rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-xs font-mono text-[var(--muted-foreground)] w-14 sm:w-16 text-right flex-shrink-0">
                {formatDuration(cat.seconds)}
              </span>
              <span className="hidden sm:block text-xs text-[var(--muted-foreground)] w-8 text-right flex-shrink-0">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--muted-foreground)] text-right font-mono">
        {formatDuration(totalAll)} total
      </p>
    </div>
  );
}
