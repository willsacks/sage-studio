import { z } from "zod";
import { withRls, withRlsWrite } from "@/lib/server/db/with-rls";
import { hasScope, type Principal } from "@/lib/server/auth/principal";
import { writeAuditLog } from "@/lib/server/audit/write";
import { OpValidationError, type AnyOperation } from "@/lib/server/contract/operation";

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
    // The one branch point that decides the actual Postgres transaction
    // mode — op.mutates (not op.minScope) is what run-operation trusts,
    // see operation.ts's doc comment and ci-safety-checks.ts's enforcement
    // that the two must agree.
    const runner = op.mutates ? withRlsWrite : withRls;
    const output = await runner(principal, (db) => op.handler({ db, principal }, input));
    const parsed = op.output.parse(output);
    await writeAuditLog({ requestId, principal, operation: op.id, tool: op.tool, module: op.module, status: "ok", latencyMs: Date.now() - start });
    return { data: parsed };
  } catch (err) {
    if (err instanceof OpValidationError) {
      await writeAuditLog({ requestId, principal, operation: op.id, tool: op.tool, module: op.module, status: "error", errorCode: "invalid_input", latencyMs: Date.now() - start });
      return { error: { code: "invalid_input", message: err.message, request_id: requestId } };
    }
    const message = err instanceof Error ? err.message : "internal";
    const KNOWN_MESSAGES: Record<string, { code: string; publicMessage: string }> = {
      not_found: { code: "not_found", publicMessage: "Not found" },
      conflict: { code: "conflict", publicMessage: "This was changed elsewhere since you last read it — fetch it again before retrying." },
      duplicate: { code: "conflict", publicMessage: "That already exists — this wasn't a stale write, it's an actual duplicate." },
    };
    const known = KNOWN_MESSAGES[message];
    const code = known?.code ?? "internal";
    await writeAuditLog({ requestId, principal, operation: op.id, tool: op.tool, module: op.module, status: "error", errorCode: code, latencyMs: Date.now() - start });
    return {
      error: {
        code,
        message: known?.publicMessage ?? "Something went wrong processing this request.",
        request_id: requestId,
      },
    };
  }
}
