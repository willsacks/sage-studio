import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryQboAllPages, QboApiError } from "@/lib/finance/qbo-client";
import { getValidQboAccessToken } from "@/lib/finance/qbo-token";
import { commitAccounts, commitCustomers, commitInvoiceBatch, commitPayment } from "@/lib/finance/import-commit";
import { mapQboAccount, mapQboContact, mapQboInvoice, mapQboPayment } from "@/lib/finance/qbo-mapping";
import { triggerImportRun } from "@/lib/finance/trigger-import";

// Chunked/resumable historical pull — a company file with thousands of
// records across many object types can exceed one request's time budget.
// This route processes one phase at a time, paginating within each phase
// via queryQboAllPages, and — before its own budget runs out — re-invokes
// itself so the whole pull can span many requests without any new
// job-queue infrastructure. maxDuration=300 matches the one other
// long-running route in this repo (app/api/cron/backup/route.ts).
export const maxDuration = 300;

// Phase 2 scope: chart of accounts, customers/vendors, and the
// Invoice+Payment pairing (the highest-value, best-understood transaction
// types, and where this chunked execution model gets proven at real
// scale). Remaining object types (Deposit, Purchase, JournalEntry,
// Transfer, Bill, BillPayment, CreditCardPayment) are added in Phase 3,
// each as an additional case in this same switch.
const PHASE_ORDER = ["accounts", "customers", "invoices", "payments", "done"] as const;
type Phase = (typeof PHASE_ORDER)[number];

type CursorState = { startPosition?: number; subEntity?: "Customer" | "Vendor" };

function nextPhase(phase: Phase): Phase {
  const idx = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[idx + 1] ?? "done";
}

type QboAccountRow = { Id: string; Name: string; AccountType: string; ParentRef?: { value: string } };
type QboContactRow = { Id: string; DisplayName: string; PrimaryEmailAddr?: { Address: string }; PrimaryPhone?: { FreeFormNumber: string }; BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string } };
type QboInvoiceRow = Parameters<typeof mapQboInvoice>[0];
type QboPaymentRow = Parameters<typeof mapQboPayment>[0];

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const deadline = startedAt + 270_000;
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
  const entityId = job.entity_id;

  let phase: Phase = PHASE_ORDER.includes(job.phase as Phase) ? (job.phase as Phase) : "accounts";
  let cursor: CursorState = (job.cursor_state as CursorState) ?? {};

  async function persistProgress(nextCursor: CursorState) {
    cursor = nextCursor;
    await supabase.from("import_jobs").update({ cursor_state: cursor, updated_at: new Date().toISOString() }).eq("id", jobId);
  }

  function continueLater() {
    // Same after()-based trigger as the OAuth callback route uses to kick
    // this runner off in the first place — a bare fire-and-forget fetch
    // here would be subject to the exact same serverless-freeze risk this
    // whole chunking design exists to work around.
    triggerImportRun(request.url, jobId);
  }

  try {
    while (phase !== "done") {
      if (phase === "accounts") {
        const { done, nextStartPosition } = await queryQboAllPages<QboAccountRow>({
          accessToken, realmId, environment, entity: "Account",
          startPosition: cursor.startPosition ?? 1,
          deadline,
          onPage: async (rows) => {
            const result = await commitAccounts(supabase, entityId, rows.map(mapQboAccount));
            if ("error" in result) throw new Error(result.error);
          },
        });
        if (!done) {
          await persistProgress({ startPosition: nextStartPosition });
          await continueLater();
          return NextResponse.json({ status: "continuing", phase });
        }
      }

      if (phase === "customers") {
        const subEntities: ("Customer" | "Vendor")[] = ["Customer", "Vendor"];
        const startFrom = subEntities.indexOf(cursor.subEntity ?? "Customer");
        for (const subEntity of subEntities.slice(Math.max(startFrom, 0))) {
          const { done, nextStartPosition } = await queryQboAllPages<QboContactRow>({
            accessToken, realmId, environment, entity: subEntity,
            startPosition: subEntity === cursor.subEntity ? (cursor.startPosition ?? 1) : 1,
            deadline,
            onPage: async (rows) => {
              const result = await commitCustomers(supabase, entityId, rows.map(mapQboContact), "quickbooks");
              if ("error" in result) throw new Error(result.error);
            },
          });
          if (!done) {
            await persistProgress({ subEntity, startPosition: nextStartPosition });
            await continueLater();
            return NextResponse.json({ status: "continuing", phase });
          }
        }
      }

      if (phase === "invoices") {
        const { done, nextStartPosition } = await queryQboAllPages<QboInvoiceRow>({
          accessToken, realmId, environment, entity: "Invoice",
          startPosition: cursor.startPosition ?? 1,
          deadline,
          onPage: async (rows) => {
            const result = await commitInvoiceBatch(supabase, entityId, rows.map(mapQboInvoice));
            if ("error" in result) throw new Error(result.error);
          },
        });
        if (!done) {
          await persistProgress({ startPosition: nextStartPosition });
          await continueLater();
          return NextResponse.json({ status: "continuing", phase });
        }
      }

      if (phase === "payments") {
        const { done, nextStartPosition } = await queryQboAllPages<QboPaymentRow>({
          accessToken, realmId, environment, entity: "Payment",
          startPosition: cursor.startPosition ?? 1,
          deadline,
          onPage: async (rows) => {
            for (const payment of rows.flatMap(mapQboPayment)) {
              const result = await commitPayment(supabase, entityId, job.owner_id, payment);
              // A single unresolvable payment (e.g. references an invoice
              // that was excluded/voided in QuickBooks) shouldn't abort the
              // whole import — log it as a job-level note and keep going.
              if ("error" in result) {
                await supabase.from("import_jobs").update({ error_message: result.error }).eq("id", jobId);
              }
            }
          },
        });
        if (!done) {
          await persistProgress({ startPosition: nextStartPosition });
          await continueLater();
          return NextResponse.json({ status: "continuing", phase });
        }
      }

      phase = nextPhase(phase);
      cursor = {};
      await supabase.from("import_jobs").update({ phase, cursor_state: {}, updated_at: new Date().toISOString() }).eq("id", jobId);
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
