import { z } from "zod";
import { withRls } from "@/lib/server/db/with-rls";
import { hasScope, type Principal } from "@/lib/server/auth/principal";
import { writeAuditLog } from "@/lib/server/audit/write";
import type { AnyOperation } from "@/lib/server/contract/operation";

export interface OpError {
  error: { code: string; message: string; request_id: string };
}
export interface OpSuccess<T = unknown> {
  data: T;
}

/** The one pipeline both REST and MCP call: scope check → input.parse →
 * withRls(handler) → output.parse → audit (always, including failures).
 * A handler that throws Error("not_found") maps to a 404-shaped error
 * without leaking whether the row exists but is someone else's vs.
 * doesn't exist at all — RLS already made sure of that upstream. */
export async function runOperation(op: AnyOperation, principal: Principal, rawInput: unknown): Promise<OpSuccess | OpError> {
  const requestId = principal.requestId;

  if (!hasScope(principal, op.module, op.minScope)) {
    await writeAuditLog({ requestId, principal, operation: op.id, tool: op.tool, module: op.module, status: "denied", errorCode: "forbidden_scope" });
    return { error: { code: "forbidden_scope", message: `This connection doesn't have ${op.minScope} access to ${op.module}.`, request_id: requestId } };
  }

  let input: unknown;
  try {
    input = op.input.parse(rawInput);
  } catch (err) {
    await writeAuditLog({ requestId, principal, operation: op.id, tool: op.tool, module: op.module, status: "error", errorCode: "invalid_input" });
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid input" : "Invalid input";
    return { error: { code: "invalid_input", message, request_id: requestId } };
  }

  const start = Date.now();
  try {
    const output = await withRls(principal, (db) => op.handler({ db, principal }, input));
    const parsed = op.output.parse(output);
    await writeAuditLog({ requestId, principal, operation: op.id, tool: op.tool, module: op.module, status: "ok", latencyMs: Date.now() - start });
    return { data: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal";
    const code = message === "not_found" ? "not_found" : "internal";
    await writeAuditLog({ requestId, principal, operation: op.id, tool: op.tool, module: op.module, status: "error", errorCode: code, latencyMs: Date.now() - start });
    return {
      error: {
        code,
        message: code === "not_found" ? "Not found" : "Something went wrong processing this request.",
        request_id: requestId,
      },
    };
  }
}
