"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface NamedPreset {
  label: string;
  from: string;
  to: string;
}

function buildPresets(): NamedPreset[] {
  const now = new Date();

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const last3Start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);

  return [
    { label: "This week",      from: isoDate(thisWeekStart),  to: isoDate(now) },
    { label: "This month",     from: isoDate(thisMonthStart), to: isoDate(now) },
    { label: "Last month",     from: isoDate(lastMonthStart), to: isoDate(lastMonthEnd) },
    { label: "Last 3 months",  from: isoDate(last3Start),     to: isoDate(now) },
    { label: "This year",      from: isoDate(thisYearStart),  to: isoDate(now) },
    { label: "All time",       from: "",                       to: "" },
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

  const presets = buildPresets();
  const matchedPreset = presets.find((p) => p.from === from && p.to === to);
  const isCustom = !matchedPreset;

  // customOpen tracks whether the custom date inputs are visible, independent of URL state.
  // isCustom (URL-derived) opens them automatically; clicking "Custom" also opens them.
  const [customOpen, setCustomOpen] = useState(isCustom);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  useEffect(() => {
    if (isCustom) {
      setCustomOpen(true);
      setCustomFrom(from);
      setCustomTo(to);
    }
  }, [from, to, isCustom]);

  const push = useCallback((f: string, t: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (f) params.set("from", f); else params.delete("from");
    if (t) params.set("to", t); else params.delete("to");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams]);

  function applyCustom(f: string, t: string) {
    if (f || t) push(f, t);
  }

  return (
    <div className="space-y-2">
      {/* Preset + Custom buttons */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { setCustomOpen(false); push(p.from, p.to); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !customOpen && matchedPreset?.label === p.label
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {p.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            const today = isoDate(new Date());
            const monthAgo = isoDate(new Date(new Date().setMonth(new Date().getMonth() - 1)));
            setCustomFrom(from || monthAgo);
            setCustomTo(to || today);
            setCustomOpen(true);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            customOpen
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom date inputs — appear below when Custom is active */}
      {customOpen && (
        <div className="flex flex-wrap items-center gap-2 pl-0.5">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            onBlur={() => applyCustom(customFrom, customTo)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
          />
          <span className="text-xs text-[var(--muted-foreground)]">–</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            onBlur={() => applyCustom(customFrom, customTo)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
      )}
    </div>
  );
}
