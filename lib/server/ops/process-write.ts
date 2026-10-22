import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";

export const processSetCell = defineOperation({
  id: "process.setCell",
  tool: "process_set_cell",
  module: "process",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/process/cells" },
  title: "Set a Process board cell",
  description: "Sets (or clears, by passing an empty label and no color) one cell on the Process Game grid by its position.",
  input: z.object({ position: z.number().int(), label: z.string().max(200).nullable(), color: z.string().nullable() }),
  output: z.object({ success: z.literal(true) }),
  handler: async (ctx, input) => {
    const trimmed = input.label?.trim() ?? "";
    if (!trimmed && !input.color) {
      await ctx.db.query(`delete from public.process_game_cells where user_id = $1 and position = $2`, [ctx.principal.userId, input.position]);
    } else {
      await ctx.db.query(
        `insert into public.process_game_cells (user_id, position, label, color, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (user_id, position) do update set label = excluded.label, color = excluded.color, updated_at = now()`,
        [ctx.principal.userId, input.position, trimmed || null, input.color]
      );
    }
    return { success: true } as const;
  },
});

export const processCreateProgram = defineOperation({
  id: "process.createProgram",
  tool: "process_create_program",
  module: "process",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/process/programs" },
  title: "Create a Process program",
  description: "Creates a new program (a named track with a set number of spots) on the Process Game board.",
  input: z.object({ name: z.string().min(1).max(100), totalSpots: z.number().int().min(1).max(500), color: z.string().min(1).max(20) }),
  output: z.object({ id: z.string(), name: z.string(), total_spots: z.number(), color: z.string(), position: z.number() }),
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `insert into public.process_game_programs (user_id, name, total_spots, color, position)
       values ($1, $2, $3, $4, (select coalesce(max(position), -1) + 1 from public.process_game_programs where user_id = $1))
       returning id, name, total_spots, color, position`,
      [ctx.principal.userId, input.name.trim(), input.totalSpots, input.color]
    );
    return rows[0];
  },
});

export const processSetSpot = defineOperation({
  id: "process.setSpot",
  tool: "process_set_spot",
  module: "process",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/process/programs/:programId/spots" },
  title: "Set a Process program spot",
  description: "Sets (or clears, by passing an empty label and no color) one numbered spot within a program.",
  input: z.object({ programId: z.string(), position: z.number().int(), label: z.string().max(200).nullable(), color: z.string().nullable() }),
  output: z.object({ success: z.literal(true) }),
  handler: async (ctx, input) => {
    const { rows: prog } = await ctx.db.query(`select 1 from public.process_game_programs where id = $1 and user_id = $2`, [input.programId, ctx.principal.userId]);
    if (prog.length === 0) throw new Error("not_found");

    const trimmed = input.label?.trim() ?? "";
    if (!trimmed && !input.color) {
      await ctx.db.query(`delete from public.process_game_spots where program_id = $1 and position = $2 and user_id = $3`, [input.programId, input.position, ctx.principal.userId]);
    } else {
      await ctx.db.query(
        `insert into public.process_game_spots (program_id, user_id, position, label, color, updated_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (program_id, position) do update set label = excluded.label, color = excluded.color, updated_at = now()`,
        [input.programId, ctx.principal.userId, input.position, trimmed || null, input.color]
      );
    }
    return { success: true } as const;
  },
});

export const processSaveJournal = defineOperation({
  id: "process.saveJournal",
  tool: "process_save_journal",
  module: "process",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/process/journal" },
  title: "Save the Process journal",
  description: "Replaces the user's Process Game journal entirely with the given lists of learnings and conclusions/actions.",
  input: z.object({ learnings: z.array(z.string()), conclusionsActions: z.array(z.string()) }),
  output: z.object({ success: z.literal(true) }),
  handler: async (ctx, input) => {
    await ctx.db.query(
      `insert into public.process_game_journal (user_id, learnings, conclusions_actions, updated_at)
       values ($1, $2, $3, now())
       on conflict (user_id) do update set learnings = excluded.learnings, conclusions_actions = excluded.conclusions_actions, updated_at = now()`,
      [ctx.principal.userId, input.learnings, input.conclusionsActions]
    );
    return { success: true } as const;
  },
});

export const processWriteOperations = [processSetCell, processCreateProgram, processSetSpot, processSaveJournal];
