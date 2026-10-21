import { todosOperations } from "@/lib/server/ops/todos";
import { knowledgeOperations } from "@/lib/server/ops/knowledge";
import { timeOperations } from "@/lib/server/ops/time-entries";
import { financeOperations } from "@/lib/server/ops/finance";
import type { AnyOperation } from "@/lib/server/contract/operation";

export const operations: AnyOperation[] = [...todosOperations, ...knowledgeOperations, ...timeOperations, ...financeOperations];

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
