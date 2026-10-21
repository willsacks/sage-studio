import type { z } from "zod";
import type { PoolClient } from "pg";
import type { Principal, Module, ScopeLevel } from "@/lib/server/auth/principal";

export interface OpCtx {
  db: PoolClient;
  principal: Principal;
}

/** One capability, exposed identically through REST (`/api/v1/...`) and
 * MCP (`/api/mcp`) — both adapters call the exact same `handler`, so
 * there's one source of truth per capability regardless of transport.
 *
 * `mutates` is the one field that changes the actual DB transaction mode
 * (run-operation.ts: `withRlsWrite` instead of the read-only `withRls`)
 * — not just a label. See scripts/ci-safety-checks.ts, which enforces
 * that every `mutates: true` operation also has `minScope: "write"` and
 * lives in a file explicitly allowed to contain mutating SQL. */
export interface Operation<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  id: string; // 'todos.list'
  tool: string; // 'todos_list' — the MCP tool name
  module: Module;
  minScope: ScopeLevel; // 'read' | 'write' — 'none' is never valid here
  mutates?: boolean; // default false/undefined — runs read-only (BEGIN READ ONLY)
  http: { method: "GET" | "POST"; path: string }; // '/todos' — mounted under /api/v1
  title: string;
  description: string; // LLM-facing
  input: I;
  output: O;
  handler: (ctx: OpCtx, input: z.infer<I>) => Promise<z.infer<O>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyOperation = Operation<any, any>;

/** Identity helper so each op file can write `defineOperation({ ... })`
 * and get full input/output type inference in its own `handler`, while
 * still being assignable to AnyOperation in the registry — annotating
 * with the bare `Operation` type instead loses that inference (I/O
 * default to z.ZodType, so z.infer<...> collapses to `unknown`). */
export function defineOperation<I extends z.ZodType, O extends z.ZodType>(op: Operation<I, O>): Operation<I, O> {
  return op;
}

