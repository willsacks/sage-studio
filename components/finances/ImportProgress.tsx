"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, TriangleAlert } from "lucide-react";
import { getImportJobStatus } from "@/lib/actions/finance-qbo";

type Job = {
  id: string;
  entity_id: string | null;
  source: "quickbooks" | "wave";
  status: "pending" | "running" | "completed" | "failed";
  phase: string;
  progress_current: number;
  progress_total: number;
  error_message: string | null;
  updated_at: string;
};

const PHASE_LABELS: Record<string, string> = {
  staging: "Getting started",
  creating_entity: "Setting up your new books",
  accounts: "Importing your chart of accounts",
  customers: "Importing your customers and vendors",
  invoices: "Importing your invoices",
  payments: "Importing your payments",
  done: "Done",
};

const STALL_THRESHOLD_MS = 30_000;

/** Polls import_jobs for UI feedback only — for QuickBooks, the actual
 * progress is driven independently by the self-re-invoking Route Handler
 * chain (app/api/finance/qbo/import/route.ts), so progress continues even
 * if this page is closed and reopened. */
export function ImportProgress({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const lastChangeRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await getImportJobStatus(jobId);
      if (cancelled) return;
      if (!result.job) {
        setError(result.error ?? "Import job not found");
        return;
      }
      const job = result.job as Job;
      setJob(job);

      // A change in phase/progress/updated_at means real work is
      // happening; if none of those move for a while, the job is likely
      // stuck (e.g. the trigger silently failed) rather than just slow.
      const key = `${job.phase}:${job.progress_current}:${job.updated_at}`;
      const now = Date.now();
      if (!lastChangeRef.current || lastChangeRef.current.key !== key) {
        lastChangeRef.current = { key, at: now };
        setStalled(false);
      } else if (now - lastChangeRef.current.at > STALL_THRESHOLD_MS) {
        setStalled(true);
      }

      if (job.status === "pending" || job.status === "running") {
        setTimeout(poll, 2500);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [jobId]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-red-600">
          <XCircle size={18} /> <p className="text-sm font-medium">Import ran into a problem</p>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{job.error_message}</p>
        {job.entity_id && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Anything already imported is safe — go to{" "}
            <Link href={`/finances?entity=${job.entity_id}`} className="text-[var(--primary)] hover:underline">your new entity</Link>{" "}
            to review what came through.
          </p>
        )}
      </div>
    );
  }

  if (job.status === "completed") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 size={18} /> <p className="text-sm font-medium">Import complete</p>
        </div>
        <Link
          href={`/finances?entity=${job.entity_id}`}
          className="inline-flex items-center text-sm font-medium text-[var(--primary)] hover:underline"
        >
          Go to your books →
        </Link>
      </div>
    );
  }

  const label = PHASE_LABELS[job.phase] ?? "Importing";
  const hasCount = job.progress_total > 0;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" />
          <p className="text-sm font-medium">
            {label}
            {hasCount ? `... (${job.progress_current}/${job.progress_total})` : job.progress_current > 0 ? `... (${job.progress_current} so far)` : "..."}
          </p>
        </div>
        {hasCount && (
          <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all"
              style={{ width: `${Math.min(100, Math.round((job.progress_current / job.progress_total) * 100))}%` }}
            />
          </div>
        )}
        <p className="text-xs text-[var(--muted-foreground)]">
          This can take a few minutes for a large company file. The import keeps running even if you navigate away —
          but we don't have a way to notify you when it's done yet, so you'll need to come back to this page (or the Finances tab) to check.
        </p>
      </div>

      {stalled && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <TriangleAlert size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            This hasn't moved in a while — it may be stuck rather than just slow. Try refreshing the page; if it's still stuck after that, let us know.
          </p>
        </div>
      )}
    </div>
  );
}
