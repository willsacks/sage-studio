import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  format, startOfWeek, addWeeks, addDays, addMonths,
  startOfDay, startOfMonth, differenceInDays,
} from "date-fns";
import { Building2, Clock, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DateRangePicker } from "@/components/tasks/DateRangePicker";
import { PrintButton } from "@/components/tasks/PrintButton";

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

function rangeLabel(from: string, to: string) {
  if (!from && !to) return "All time";
  if (from && to) return `${format(new Date(from), "MMM d, yyyy")} – ${format(new Date(to), "MMM d, yyyy")}`;
  if (from) return `From ${format(new Date(from), "MMM d, yyyy")}`;
  return `Up to ${format(new Date(to), "MMM d, yyyy")}`;
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from = "", to = "" } = await searchParams;

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

  // Build date-filtered query
  let query = supabase
    .from("time_entries")
    .select("id, description, started_at, stopped_at, duration_seconds, category")
    .eq("client_id", id)
    .eq("user_id", user.id)
    .not("stopped_at", "is", null)
    .order("started_at", { ascending: false });

  if (from) query = query.gte("started_at", `${from}T00:00:00`);
  if (to)   query = query.lte("started_at", `${to}T23:59:59`);

  const { data: entriesRaw } = await query;

  const entries = (entriesRaw ?? []) as {
    id: string;
    description: string;
    started_at: string;
    stopped_at: string;
    duration_seconds: number | null;
    category: string | null;
  }[];

  function entryDuration(e: { duration_seconds: number | null; started_at: string; stopped_at: string }) {
    if (e.duration_seconds != null && e.duration_seconds > 0) return e.duration_seconds;
    return Math.max(0, Math.floor((new Date(e.stopped_at).getTime() - new Date(e.started_at).getTime()) / 1000));
  }

  const totalSecs = entries.reduce((s, e) => s + entryDuration(e), 0);
  const sessionCount = entries.length;

  // Adaptive chart: pick granularity based on the selected date range
  const now = new Date();
  const chartEnd = to ? new Date(`${to}T23:59:59`) : now;
  const chartStart = from
    ? new Date(`${from}T00:00:00`)
    : entries.length > 0
      ? startOfDay(new Date(entries[entries.length - 1].started_at))
      : addMonths(now, -3);

  const spanDays = differenceInDays(chartEnd, chartStart);
  type Granularity = "day" | "week" | "month";
  const granularity: Granularity =
    spanDays <= 14 ? "day" : spanDays <= 90 ? "week" : "month";

  const chartBuckets: { label: string; seconds: number }[] = [];

  if (granularity === "day") {
    const days = Math.max(spanDays + 1, 1);
    for (let i = 0; i < days; i++) {
      const day = startOfDay(addDays(chartStart, i));
      const next = addDays(day, 1);
      const secs = entries
        .filter((e) => { const d = new Date(e.started_at); return d >= day && d < next; })
        .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
      chartBuckets.push({ label: format(day, "MMM d"), seconds: secs });
    }
  } else if (granularity === "week") {
    let cursor = startOfWeek(chartStart, { weekStartsOn: 1 });
    while (cursor <= chartEnd) {
      const next = addWeeks(cursor, 1);
      const secs = entries
        .filter((e) => { const d = new Date(e.started_at); return d >= cursor && d < next; })
        .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
      chartBuckets.push({ label: format(cursor, "MMM d"), seconds: secs });
      cursor = next;
    }
  } else {
    let cursor = startOfMonth(chartStart);
    while (cursor <= chartEnd) {
      const next = addMonths(cursor, 1);
      const secs = entries
        .filter((e) => { const d = new Date(e.started_at); return d >= cursor && d < next; })
        .reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
      chartBuckets.push({ label: format(cursor, "MMM ''yy"), seconds: secs });
      cursor = next;
    }
  }

  const maxBucketSecs = Math.max(...chartBuckets.map((b) => b.seconds), 1);
  const chartLabel = granularity === "day" ? "Daily" : granularity === "week" ? "Weekly" : "Monthly";
  const printDate = format(now, "MMMM d, yyyy");

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media screen {
          .print-only { display: none !important; }
          .print-footer { display: none !important; }
        }

        @media print {
          /* Hide everything, then reveal the report */
          body * { visibility: hidden; }
          #client-report, #client-report * { visibility: visible; }

          /* Items to exclude from print entirely */
          .print-hidden { display: none !important; }

          /* Items only visible in print */
          .print-only {
            display: block !important;
            visibility: visible !important;
          }

          #client-report {
            position: absolute;
            inset: 0;
            padding: 40px 52px 96px;
            max-width: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
            color: #111827;
            background: #fff;
          }

          /* Branded header */
          .print-brand-header {
            display: flex !important;
            visibility: visible !important;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 28px;
            padding-bottom: 16px;
            border-bottom: 1.5px solid #111827;
          }

          .print-brand-left {
            display: flex !important;
            align-items: center;
            gap: 10px;
          }

          .print-brand-name {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #111827;
          }

          .print-brand-tagline {
            font-size: 9px;
            color: #6b7280;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            display: block;
            margin-top: 1px;
          }

          .print-brand-url {
            font-size: 11px;
            color: #6b7280;
            letter-spacing: 0.01em;
          }

          /* Report title area */
          .print-report-title {
            margin-bottom: 24px;
          }

          .print-report-title h1 {
            font-size: 26px;
            font-weight: 700;
            letter-spacing: -0.03em;
            color: #111827;
            margin: 0 0 4px;
          }

          .print-report-title .client-name {
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            margin: 0 0 3px;
          }

          .print-report-title .date-range {
            font-size: 11px;
            color: #9ca3af;
          }

          /* Stats */
          .print-stats {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            margin-bottom: 20px;
          }

          .print-stat {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 12px 14px;
            background: #f9fafb;
          }

          .print-stat-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: #9ca3af;
            margin-bottom: 4px;
          }

          .print-stat-value {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
            font-variant-numeric: tabular-nums;
          }

          /* Chart */
          .chart-container {
            margin-bottom: 20px;
            padding: 16px 16px 12px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f9fafb;
          }

          .chart-title {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: #9ca3af;
            margin-bottom: 10px;
          }

          /* Session table */
          .sessions-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          .sessions-table th {
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: #9ca3af;
            padding: 0 0 8px;
            border-bottom: 1px solid #e5e7eb;
          }

          .sessions-table td {
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
            color: #374151;
            vertical-align: middle;
          }

          .sessions-table td.desc {
            color: #111827;
            font-weight: 500;
          }

          .sessions-table td.desc.empty {
            color: #9ca3af;
            font-style: italic;
            font-weight: 400;
          }

          .sessions-table td.mono {
            font-variant-numeric: tabular-nums;
            font-family: 'SF Mono', 'Courier New', monospace;
            text-align: right;
            color: #111827;
            font-weight: 600;
          }

          .sessions-table th.right {
            text-align: right;
          }

          /* Fixed footer */
          .print-footer {
            position: fixed !important;
            bottom: 28px !important;
            left: 52px !important;
            right: 52px !important;
            display: flex !important;
            visibility: visible !important;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid #e5e7eb;
            padding-top: 10px;
            font-size: 10px;
            color: #9ca3af;
          }

          .print-footer .footer-brand {
            font-weight: 600;
            color: #6b7280;
          }

          .print-footer .footer-url {
            font-weight: 500;
            color: #6b7280;
          }
        }
      `}</style>

      <div id="client-report" className="max-w-3xl space-y-6">

        {/* ── PRINT-ONLY: Sage Studio branded header ── */}
        <div className="print-only print-brand-header" aria-hidden="true">
          <div className="print-brand-left">
            {/* Sage Studio logomark — S-curve in a rounded square */}
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="34" height="34" rx="8" fill="#111827"/>
              <path d="M23 12C23 12 21 10 17 10C13 10 11 12 11 14C11 16 13 17 17 17.5C21 18 23 19.5 23 21.5C23 23.5 21 24 17 24C13 24 11 22 11 22" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <div>
              <span className="print-brand-name">Sage Studio</span>
              <span className="print-brand-tagline">Studio Management</span>
            </div>
          </div>
          <span className="print-brand-url">www.sagestudio.org</span>
        </div>

        {/* ── PRINT-ONLY: report title block ── */}
        <div className="print-only print-report-title" aria-hidden="true">
          <h1>Time Report</h1>
          <p className="client-name">{clientData.name}</p>
          <p className="date-range">{rangeLabel(from, to)}</p>
        </div>

        {/* ── SCREEN-ONLY: header with back arrow, title, export button ── */}
        <div className="print-hidden flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/tasks"
              className="p-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Time Report</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 size={13} className="text-[var(--muted-foreground)]" />
                <p className="text-[var(--muted-foreground)] text-sm font-medium">{clientData.name}</p>
              </div>
              <p className="text-[var(--muted-foreground)] text-xs mt-0.5">{rangeLabel(from, to)}</p>
            </div>
          </div>
          <PrintButton />
        </div>

        {/* Date range picker — screen only */}
        <div className="print-hidden">
          <Suspense>
            <DateRangePicker from={from} to={to} />
          </Suspense>
        </div>

        {/* Stats */}
        <div className="print-stats grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="print-stat rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="print-stat-label flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
              <Clock size={13} className="print-hidden" /> Total time
            </div>
            <p className="print-stat-value text-2xl font-bold font-mono">{formatDuration(totalSecs)}</p>
          </div>
          <div className="print-stat rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="print-stat-label flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
              <Calendar size={13} className="print-hidden" /> Sessions
            </div>
            <p className="print-stat-value text-2xl font-bold">{sessionCount}</p>
          </div>
          {sessionCount > 0 && (
            <div className="print-stat rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="print-stat-label flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
                <Clock size={13} className="print-hidden" /> Avg session
              </div>
              <p className="print-stat-value text-2xl font-bold font-mono">{formatDuration(Math.round(totalSecs / sessionCount))}</p>
            </div>
          )}
        </div>

        {/* Adaptive activity chart */}
        {totalSecs > 0 && (
          <div className="chart-container rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="chart-title text-sm font-semibold mb-4">{chartLabel} activity</h2>
            <div className="flex items-end gap-1 overflow-x-auto">
              {chartBuckets.map((b, i) => (
                <div key={i} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: "72px" }}>
                    <div
                      className="w-full bg-[var(--primary)] rounded-t-sm transition-all"
                      style={{ height: `${Math.round((b.seconds / maxBucketSecs) * 72)}px`, minHeight: b.seconds > 0 ? "2px" : "0" }}
                    />
                  </div>
                  <span className="text-[9px] text-[var(--muted-foreground)] text-center leading-tight whitespace-nowrap">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entry log */}
        {entries.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted-foreground)]">
            <Building2 size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No time entries for this period.</p>
          </div>
        ) : (
          <>
            {/* Screen view: card list */}
            <div className="print-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)]">
                <h2 className="text-sm font-semibold">Sessions</h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
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
                    <span className={`font-mono text-sm font-medium flex-shrink-0 tabular-nums ${entryDuration(entry) > 8 * 3600 ? "text-amber-500" : "text-[var(--foreground)]"}`}>
                      {(() => { const s = entryDuration(entry); return s > 0 ? formatDuration(s) : "—"; })()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Print view: clean table */}
            <div className="print-only" aria-hidden="true">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th style={{ width: "40%" }}>Description</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th className="right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className={entry.description ? "desc" : "desc empty"}>
                        {entry.description || "No description"}
                      </td>
                      <td>{format(new Date(entry.started_at), "EEE, MMM d")}</td>
                      <td>{formatTime(entry.started_at)} – {formatTime(entry.stopped_at)}</td>
                      <td className={`mono ${entryDuration(entry) > 8 * 3600 ? "text-amber-600" : ""}`}>
                        {(() => { const s = entryDuration(entry); return s > 0 ? formatDuration(s) : "—"; })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Print footer */}
        <div className="print-footer">
          <span className="footer-brand">Sage Studio</span>
          <span>{printDate} · {clientData.name}</span>
          <span className="footer-url">www.sagestudio.org</span>
        </div>
      </div>
    </>
  );
}
