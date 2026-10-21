import { queryPrivileged } from "@/lib/server/db/privileged";
import type { Principal } from "@/lib/server/auth/principal";

interface RawAuditEntry {
  requestId: string;
  userId: string | null;
  clientId: string | null;
  grantId: string | null;
  channel: string;
  operation: string;
  tool?: string | null;
  module?: string | null;
  status: "ok" | "error" | "denied" | "rate_limited";
  errorCode?: string | null;
  latencyMs?: number | null;
}

/** Append-only by a DB trigger (sage.api_audit_log_no_update) — this is
 * the only writer. A failure here must never fail the user's actual
 * request, so every call site awaits this but the function itself
 * swallows and logs rather than throwing. */
async function writeRawAuditEntry(entry: RawAuditEntry): Promise<void> {
  try {
    await queryPrivileged(
      `insert into sage.api_audit_log
        (request_id, user_id, client_id, grant_id, channel, operation, tool, module, result_status, error_code, latency_ms)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        entry.requestId, entry.userId, entry.clientId, entry.grantId,
        entry.channel, entry.operation, entry.tool ?? null, entry.module ?? null,
        entry.status, entry.errorCode ?? null, entry.latencyMs ?? null,
      ]
    );
  } catch (err) {
    console.error("[sage.api_audit_log] failed to write audit entry", err);
  }
}

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
  await writeRawAuditEntry({
    requestId: entry.requestId,
    userId: entry.principal.userId,
    clientId: entry.principal.clientId ?? null,
    grantId: entry.principal.grantId ?? null,
    channel: entry.principal.channel,
    operation: entry.operation,
    tool: entry.tool,
    module: entry.module,
    status: entry.status,
    errorCode: entry.errorCode,
    latencyMs: entry.latencyMs,
  });
}

/** For OAuth-flow events that happen before a Principal exists (token
 * exchange, refresh, revocation-on-reuse) — same table, same trigger,
 * just without the request-scoped Principal the REST/MCP pipeline has. */
export async function writeOauthAuditLog(entry: {
  operation: string;
  status: "ok" | "error" | "denied";
  userId?: string | null;
  clientId?: string | null;
  grantId?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  await writeRawAuditEntry({
    requestId: crypto.randomUUID(),
    userId: entry.userId ?? null,
    clientId: entry.clientId ?? null,
    grantId: entry.grantId ?? null,
    channel: "oauth",
    operation: entry.operation,
    status: entry.status,
    errorCode: entry.errorCode,
  });
}
