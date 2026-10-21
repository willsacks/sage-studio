import { todosOperations } from "@/lib/server/ops/todos";
import { todosWriteOperations } from "@/lib/server/ops/todos-write";
import { knowledgeOperations } from "@/lib/server/ops/knowledge";
import { knowledgeWriteOperations } from "@/lib/server/ops/knowledge-write";
import { timeOperations } from "@/lib/server/ops/time-entries";
import { timeWriteOperations } from "@/lib/server/ops/time-entries-write";
import { financeOperations } from "@/lib/server/ops/finance";
import { sitesOperations } from "@/lib/server/ops/sites";
import { sitesWriteOperations } from "@/lib/server/ops/sites-write";
import { coursesOperations } from "@/lib/server/ops/courses";
import type { AnyOperation } from "@/lib/server/contract/operation";

export const operations: AnyOperation[] = [
  ...todosOperations,
  ...todosWriteOperations,
  ...knowledgeOperations,
  ...knowledgeWriteOperations,
  ...timeOperations,
  ...timeWriteOperations,
  ...financeOperations,
  ...sitesOperations,
  ...sitesWriteOperations,
  ...coursesOperations,
];

// Fails at import time (build + boot), not just in CI — a mismatch here
// would mean a write-shaped handler running read-only (silently inert)
// or worse, a read-scoped operation accidentally running writable.
for (const op of operations) {
  if (op.mutates && op.minScope !== "write") {
    throw new Error(`Operation ${op.id} has mutates:true but minScope:"${op.minScope}" — mutating operations must require minScope:"write".`);
  }
}

/** Matches a REST request against the registry — op.http.path may
 * contain `:param` segments (e.g. "/knowledge/:id"). Used only by the
 * REST adapter; the MCP adapter calls operations directly by tool name. */
export function findOperationByPath(method: string, path: string): { op: AnyOperation; params: Record<string, string> } | null {
  for (const op of operations) {
    if (op.http.method !== method) continue;
    const paramNames = [...op.http.path.matchAll(/:([a-zA-Z]+)/g)].map((m) => m[1]);
    const pattern = op.http.path.replace(/:[a-zA-Z]+/g, "([^/]+)");
    const match = new RegExp(`^${pattern}$`).exec(path);
    if (match) {
      return { op, params: Object.fromEntries(paramNames.map((name, i) => [name, match[i + 1]])) };
    }
  }
  return null;
}
