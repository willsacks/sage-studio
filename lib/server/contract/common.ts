import { z } from "zod";

/** Shared zod fragments for operation inputs/outputs — kept tiny since
 * Sage Studio's per-user tables (todos/knowledge/time_entries) never have
 * enough rows for cursor pagination to matter in phase 1 the way it would
 * for a multi-tenant app; this exists so later modules (finance, sites)
 * have a consistent shape to adopt, not because today's modules need it. */
export const Cursor = z.string().max(512).optional().describe("Opaque next_cursor from a previous page.");
export const Limit = z.coerce.number().int().min(1).max(100).default(25);

export function Page<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), next_cursor: z.string().nullable() });
}
