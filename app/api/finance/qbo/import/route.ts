import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryQbo, QboApiError } from "@/lib/finance/qbo-client";
import { getValidQboAccessToken } from "@/lib/finance/qbo-token";
import { commitAccounts, commitCustomers } from "@/lib/finance/import-commit";
import { mapQboAccount, mapQboContact } from "@/lib/finance/qbo-mapping";

// Chunked/resumable historical pull — a company file with thousands of
// records across many object types can exceed one request's time budget.
// This route processes one phase at a time and, before its own budget runs
// out, re-invokes itself so the whole pull can span many requests without
// any new job-queue infrastructure. maxDuration=300 matches the one other
// long-running route in this repo (app/api/cron/backup/route.ts).
export const maxDuration = 300;

// Phase 1 scope: chart of accounts + customers/vendors only. Transaction
// object types (Invoice, Payment, Deposit, Purchase, JournalEntry,
// Transfer, Bill, BillPayment, CreditCardPayment) are added in later
// phases, each as an additional case in this same switch.
const PHASE_ORDER = ["accounts", "customers", "done"] as const;
type Phase = (typeof PHASE_ORDER)[number];

function nextPhase(phase: Phase): Phase {
  const idx = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[idx + 1] ?? "done";
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const { jobId } = await request.json();
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase.from("import_jobs").select("*").eq("id", jobId).single();
  if (jobError || !job) return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  if (job.status === "completed" || job.status === "failed") return NextResponse.json({ status: job.status });
  if (job.source !== "quickbooks" || !job.entity_id) {
    return NextResponse.json({ error: "Job is not a valid QuickBooks import" }, { status: 400 });
  }

  const { data: connection, error: connectionError } = await supabase
    .from("qbo_connections")
    .select("id")
    .eq("entity_id", job.entity_id)
    .single();
  if (connectionError || !connection) {
    await failJob(supabase, jobId, "QuickBooks connection not found");
    return NextResponse.json({ error: "QuickBooks connection not found" }, { status: 400 });
  }

  await supabase.from("import_jobs").update({ status: "running" }).eq("id", jobId);

  const tokenResult = await getValidQboAccessToken(supabase, connection.id);
  if ("error" in tokenResult) {
    await failJob(supabase, jobId, tokenResult.error);
    return NextResponse.json({ error: tokenResult.error }, { status: 400 });
  }
  const { accessToken, realmId, environment } = tokenResult;

  let phase: Phase = PHASE_ORDER.includes(job.phase as Phase) ? (job.phase as Phase) : "accounts";

  try {
    while (phase !== "done") {
      if (Date.now() - startedAt > 270_000) {
        // Out of time for this invocation — persist where we are and
        // re-invoke ourselves to continue, rather than leaving the job
        // stuck. Fire-and-forget: this response returns before the
        // continuation call resolves.
        fetch(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) }).catch(() => {});
        return NextResponse.json({ status: "continuing", phase });
      }

      if (phase === "accounts") {
        const { results } = await queryQbo<{ Id: string; Name: string; AccountType: string; ParentRef?: { value: string } }>({
          accessToken,
          realmId,
          environment,
          entity: "Account",
        });
        const result = await commitAccounts(supabase, job.entity_id, results.map(mapQboAccount));
        if ("error" in result) throw new Error(result.error);
      }

      if (phase === "customers") {
        const [{ results: customers }, { results: vendors }] = await Promise.all([
          queryQbo<{ Id: string; DisplayName: string; PrimaryEmailAddr?: { Address: string }; PrimaryPhone?: { FreeFormNumber: string }; BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string } }>({
            accessToken, realmId, environment, entity: "Customer",
          }),
          queryQbo<{ Id: string; DisplayName: string; PrimaryEmailAddr?: { Address: string }; PrimaryPhone?: { FreeFormNumber: string }; BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string } }>({
            accessToken, realmId, environment, entity: "Vendor",
          }),
        ]);
        // Vendors are merged into the same finance_customers table as
        // Customers — Sage Studio has no separate vendor-reporting concept
        // that would justify a second table.
        const result = await commitCustomers(supabase, job.entity_id, [...customers, ...vendors].map(mapQboContact), "quickbooks");
        if ("error" in result) throw new Error(result.error);
      }

      phase = nextPhase(phase);
      await supabase.from("import_jobs").update({ phase, updated_at: new Date().toISOString() }).eq("id", jobId);
    }

    await supabase.from("import_jobs").update({ status: "completed", phase: "done" }).eq("id", jobId);
    return NextResponse.json({ status: "completed" });
  } catch (err) {
    const message = err instanceof QboApiError && err.status === 401
      ? "QuickBooks access token was rejected — try reconnecting"
      : err instanceof Error ? err.message : "Import failed";
    await failJob(supabase, jobId, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function failJob(supabase: any, jobId: string, message: string) {
  await supabase.from("import_jobs").update({ status: "failed", error_message: message }).eq("id", jobId);
}
