"use client";

export type DateRange = { startDate: string; endDate: string };

export function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
export function startOfQuarter() {
  const d = new Date();
  const qMonth = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`;
}
export function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}
export function today() {
  return new Date().toISOString().slice(0, 10);
}

const RANGE_PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "This month", range: () => ({ startDate: startOfMonth(), endDate: today() }) },
  { label: "This quarter", range: () => ({ startDate: startOfQuarter(), endDate: today() }) },
  { label: "This year", range: () => ({ startDate: startOfYear(), endDate: today() }) },
  { label: "All time", range: () => ({ startDate: "2000-01-01", endDate: today() }) },
];

/** Shared date-range control — presets plus custom start/end pickers. Used
 * by the Reports tab (Income Statement, Balance Sheet's "as of" end date,
 * Project Comparison) and the Overview tab's expense/income breakdown
 * charts. Not used for anything modeled as a rolling trailing window (the
 * Trends report, Overview's monthly trend chart) — those take a plain
 * "months back" count instead, since a start/end range doesn't map cleanly
 * onto "last N months." */
export function DateRangePicker({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.range())}
            className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={range.startDate}
          onChange={(e) => onChange({ ...range, startDate: e.target.value })}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        />
        <span className="text-xs text-[var(--muted-foreground)]">to</span>
        <input
          type="date"
          value={range.endDate}
          onChange={(e) => onChange({ ...range, endDate: e.target.value })}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs"
        />
      </div>
    </div>
  );
}
