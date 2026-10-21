import { queryPrivileged } from "@/lib/server/db/privileged";
import type { Principal } from "@/lib/server/auth/principal";

/** Append-only by a DB trigger (sage.api_audit_log_no_update) — this is
 * the only writer. A failure here must never fail the user's actual
 * request, so every call site awaits this but the function itself
 * swallows and logs rather than throwing. */
export async function writeAuditLog(entry: {
  requestId: string;
  principal: Principal;
  operation: string;
  tool?: string;
  module?: string;
  status: "ok" | "error" | "denied" | "rate_limited";
  errorCode?: string;
  latencyMs?: number;
}): Promise<void> {
  try {
    await queryPrivileged(
      `insert into sage.api_audit_log
        (request_id, user_id, client_id, grant_id, channel, operation, tool, module, result_status, error_code, latency_ms)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        entry.requestId, entry.principal.userId, entry.principal.clientId ?? null, entry.principal.grantId ?? null,
        entry.principal.channel, entry.operation, entry.tool ?? null, entry.module ?? null,
        entry.status, entry.errorCode ?? null, entry.latencyMs ?? null,
      ]
    );
  } catch (err) {
    console.error("[sage.api_audit_log] failed to write audit entry", err);
  }
}
