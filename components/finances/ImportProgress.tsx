"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { getImportJobStatus } from "@/lib/actions/finance-qbo";

type Job = {
  id: string;
  entity_id: string | null;
  source: "quickbooks" | "wave";
  status: "pending" | "running" | "completed" | "failed";
  phase: string;
  error_message: string | null;
};

const PHASE_LABELS: Record<string, string> = {
  staging: "Getting started...",
  creating_entity: "Setting up your new books...",
  accounts: "Importing your chart of accounts...",
  customers: "Importing your customers and vendors...",
  done: "Done",
};

/** Polls import_jobs for UI feedback only — for QuickBooks, the actual
 * progress is driven independently by the self-re-invoking Route Handler
 * chain (app/api/finance/qbo/import/route.ts), so progress continues even
 * if this page is closed and reopened. */
export function ImportProgress({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" />
        <p className="text-sm font-medium">{PHASE_LABELS[job.phase] ?? "Importing..."}</p>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">This can take a few minutes for a large company file — you can close this tab, the import will keep running.</p>
    </div>
  );
}
