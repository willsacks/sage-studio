import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";

/** Records one row in finance_audit_log for "who did what" visibility —
 * a bookkeeper collaborating on someone else's books, or an owner
 * reviewing a bookkeeper's work, needs an answer to "why did this change"
 * beyond just the current state of a row. Best-effort: a logging failure
 * must never block the real mutation it's describing, so errors are
 * swallowed here (matching the console.error-only convention already used
 * for finance_ai_categorize_runs writes in app/api/finance/ai-categorize/route.ts).
 * Not yet in the generated Database type (lib/db.ts), so cast internally —
 * same convention as that run-log table. */
export async function logFinanceAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  params: {
    entityId: string;
    actorId: string;
    action: string;
    targetTable: string;
    targetId?: string;
    diff?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("finance_audit_log").insert({
    entity_id: params.entityId,
    actor_id: params.actorId,
    action: params.action,
    target_table: params.targetTable,
    target_id: params.targetId ?? null,
    diff: params.diff ?? null,
  });
  if (error) console.error("[finance_audit_log insert failed]", error.message);
}
