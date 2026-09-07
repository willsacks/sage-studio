"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Preset {
  label: string;
  from: string;
  to: string;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presets(): Preset[] {
  const now = new Date();

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Mon

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const last3Start = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const thisYearStart = new Date(now.getFullYear(), 0, 1);

  return [
    { label: "This week", from: isoDate(thisWeekStart), to: isoDate(now) },
    { label: "This month", from: isoDate(thisMonthStart), to: isoDate(now) },
    { label: "Last month", from: isoDate(lastMonthStart), to: isoDate(lastMonthEnd) },
    { label: "Last 3 months", from: isoDate(last3Start), to: isoDate(now) },
    { label: "This year", from: isoDate(thisYearStart), to: isoDate(now) },
    { label: "All time", from: "", to: "" },
  ];
}

interface DateRangePickerProps {
  from: string;
  to: string;
}

export function DateRangePicker({ from, to }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback((f: string, t: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (f) params.set("from", f); else params.delete("from");
    if (t) params.set("to", t); else params.delete("to");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams]);

  const activePreset = presets().find((p) => p.from === from && p.to === to);
  const isAllTime = !from && !to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {presets().map((p) => {
          const active = p.label === "All time" ? isAllTime : (p.from === from && p.to === to);
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => push(p.from, p.to)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1.5 ml-auto">
        <input
          type="date"
          value={from}
          onChange={(e) => push(e.target.value, to)}
          className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
        />
        <span className="text-xs text-[var(--muted-foreground)]">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => push(from, e.target.value)}
          className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
        />
      </div>
    </div>
  );
}
