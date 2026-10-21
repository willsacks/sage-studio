import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";

export const timeStart = defineOperation({
  id: "time.start",
  tool: "time_start",
  module: "time_tracking",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/time-entries/start" },
  title: "Start a time entry",
  description: "Starts a new timer, closing out any currently-running timer first (only one can run at a time). Uses the same atomic DB function the web app itself uses.",
  input: z.object({ description: z.string().min(1).max(500), category: z.string().nullable().optional(), clientId: z.string().nullable().optional(), todoId: z.string().nullable().optional() }),
  output: z.object({ id: z.string(), started_at: z.string(), description: z.string(), category: z.string().nullable(), client_id: z.string().nullable() }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `select * from public.start_time_entry($1, $2, $3, $4)`,
      [input.description.trim(), input.category ?? null, input.clientId ?? null, input.todoId ?? null]
    );
    return rows[0];
  },
});

export const timeStop = defineOperation({
  id: "time.stop",
  tool: "time_stop",
  module: "time_tracking",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/time-entries/:id/stop" },
  title: "Stop a time entry",
  description: "Stops a running timer by id and computes its duration. Use time_get_active_timer first to find the running entry's id.",
  input: z.object({ id: z.string() }),
  output: z.object({ id: z.string(), duration_seconds: z.number() }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(`select * from public.stop_time_entry($1)`, [input.id]);
    if (rows.length === 0) throw new Error("not_found");
    return rows[0];
  },
});

export const timeWriteOperations = [timeStart, timeStop];
