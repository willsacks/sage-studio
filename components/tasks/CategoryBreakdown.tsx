"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

interface Entry {
  duration_seconds: number | null;
  category: string | null;
  client_id: string | null;
  client_name?: string | null;
}

interface CategoryBreakdownProps {
  entries: Entry[];
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

export function CategoryBreakdown({ entries }: CategoryBreakdownProps) {
  const totals = new Map<string, { label: string; seconds: number; clientId?: string }>();

  for (const entry of entries) {
    const secs = entry.duration_seconds ?? 0;
    if (secs === 0) continue;

    if (entry.client_id) {
      const key = `client:${entry.client_id}`;
      const label = entry.client_name ?? "Client";
      const existing = totals.get(key);
      if (existing) {
        existing.seconds += secs;
      } else {
        totals.set(key, { label, seconds: secs, clientId: entry.client_id });
      }
    } else {
      const key = entry.category ?? "uncategorised";
      const label = entry.category ?? "Uncategorised";
      const existing = totals.get(key);
      if (existing) {
        existing.seconds += secs;
      } else {
        totals.set(key, { label, seconds: secs });
      }
    }
  }

  if (totals.size === 0) return null;

  const sorted = Array.from(totals.values()).sort((a, b) => b.seconds - a.seconds);
  const maxSeconds = sorted[0].seconds;
  const totalAll = sorted.reduce((s, c) => s + c.seconds, 0);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Where your time went</h2>
        <span className="text-xs text-[var(--muted-foreground)] font-mono">
          {formatDuration(totalAll)} total (90 days)
        </span>
      </div>

      <div className="space-y-2">
        {sorted.map((cat) => {
          const pct = Math.round((cat.seconds / totalAll) * 100);
          const barWidth = Math.round((cat.seconds / maxSeconds) * 100);
          return (
            <div key={cat.label + (cat.clientId ?? "")} className="flex items-center gap-3">
              <div className="w-32 flex-shrink-0">
                {cat.clientId ? (
                  <Link
                    href={`/tasks/clients/${cat.clientId}`}
                    className="text-xs text-[var(--foreground)] truncate flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
                  >
                    <Building2 size={10} className="flex-shrink-0" />
                    {cat.label}
                  </Link>
                ) : (
                  <span className="text-xs text-[var(--foreground)] truncate">{cat.label}</span>
                )}
              </div>
              <div className="flex-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)] rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-xs font-mono text-[var(--muted-foreground)] w-16 text-right flex-shrink-0">
                {formatDuration(cat.seconds)}
              </span>
              <span className="text-xs text-[var(--muted-foreground)] w-8 text-right flex-shrink-0">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
