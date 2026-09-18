import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { canManagePlatform } from "@/lib/access/platform-access";
import { getFinanceAiRuns, type FinanceAiRun } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Finance AI Runs — Admin" };

const RUN_STATUS_STYLES: Record<FinanceAiRun["status"], string> = {
  completed: "bg-green-500/10 text-green-600",
  error: "bg-red-500/10 text-red-600",
  running: "bg-amber-500/10 text-amber-600",
};

function FinanceAiRunRow({ run }: { run: FinanceAiRun }) {
  const ageMs = Date.now() - new Date(run.started_at).getTime();
  const likelyStalled = run.status === "running" && ageMs > 5 * 60 * 1000;

  return (
    <div className="py-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${RUN_STATUS_STYLES[run.status]}`}>
          {likelyStalled ? "stalled" : run.status}
        </span>
        <span className="text-sm font-medium">{run.entity_name}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{run.user_email}</span>
        <span className="text-xs text-[var(--muted-foreground)] ml-auto">
          {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })} · {run.turns} turn{run.turns === 1 ? "" : "s"} · {run.actions_taken} action{run.actions_taken === 1 ? "" : "s"}
          {run.stop_reason && ` · stop: ${run.stop_reason}`}
        </span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] truncate" title={run.message}>{run.message}</p>
      {run.error && <p className="text-xs text-red-500">{run.error}</p>}
    </div>
  );
}

export default async function AdminFinancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canManagePlatform(profile?.role)) redirect("/admin/users");

  const runs = await getFinanceAiRuns();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt size={22} /> Finance AI Categorization Runs
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Last 20 runs of the Transactions-tab AI assistant — for tracing a run that stalled or errored, independent of what the browser that triggered it saw.
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] px-4">
        {runs.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">No runs yet.</p>
        ) : (
          runs.map((run) => <FinanceAiRunRow key={run.id} run={run} />)
        )}
      </div>
    </div>
  );
}
