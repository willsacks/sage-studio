import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";
import { Page, Limit } from "@/lib/server/contract/common";

const timeEntryItem = z.object({
  id: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  started_at: z.string(),
  stopped_at: z.string().nullable(),
  duration_seconds: z.number().nullable(),
});

export const timeGetEntries = defineOperation({
  id: "time.getEntries",
  tool: "time_get_entries",
  module: "time_tracking",
  minScope: "read",
  http: { method: "GET", path: "/time-entries" },
  title: "List time entries",
  description: "List the user's time-tracking entries, most recently started first.",
  input: z.object({ limit: Limit }),
  output: Page(timeEntryItem),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `select id, description, category, started_at, stopped_at, duration_seconds
       from public.time_entries where user_id = $1 order by started_at desc limit $2`,
      [ctx.principal.userId, input.limit]
    );
    return { items: rows, next_cursor: null };
  },
});

export const timeGetActiveTimer = defineOperation({
  id: "time.getActiveTimer",
  tool: "time_get_active_timer",
  module: "time_tracking",
  minScope: "read",
  http: { method: "GET", path: "/time-entries/active" },
  title: "Get the currently running timer",
  description: "Returns the user's currently running time entry, if any (stopped_at is null).",
  input: z.object({}),
  output: timeEntryItem.nullable(),
  handler: async (ctx) => {
    const { rows } = await ctx.db.query(
      `select id, description, category, started_at, stopped_at, duration_seconds
       from public.time_entries where user_id = $1 and stopped_at is null order by started_at desc limit 1`,
      [ctx.principal.userId]
    );
    return rows[0] ?? null;
  },
});

export const timeOperations = [timeGetEntries, timeGetActiveTimer];
