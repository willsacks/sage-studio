import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";

const cell = z.object({ position: z.number(), label: z.string().nullable(), color: z.string().nullable() });
const program = z.object({ id: z.string(), name: z.string(), total_spots: z.number(), color: z.string(), position: z.number() });
const spot = z.object({ program_id: z.string(), position: z.number(), label: z.string().nullable(), color: z.string().nullable() });

export const processGetBoard = defineOperation({
  id: "process.getBoard",
  tool: "process_get_board",
  module: "process",
  minScope: "read",
  http: { method: "GET", path: "/process/board" },
  title: "Get the Process board",
  description: "Gets the user's full Process Game board: the grid cells, every program, and every program's filled spots.",
  input: z.object({}),
  output: z.object({ cells: z.array(cell), programs: z.array(program), spots: z.array(spot) }),
  handler: async (ctx) => {
    const [cells, programs, spots] = await Promise.all([
      ctx.db.query(`select position, label, color from public.process_game_cells where user_id = $1 order by position asc`, [ctx.principal.userId]),
      ctx.db.query(`select id, name, total_spots, color, position from public.process_game_programs where user_id = $1 order by position asc`, [ctx.principal.userId]),
      ctx.db.query(`select program_id, position, label, color from public.process_game_spots where user_id = $1 order by program_id, position asc`, [ctx.principal.userId]),
    ]);
    return { cells: cells.rows, programs: programs.rows, spots: spots.rows };
  },
});

export const processGetJournal = defineOperation({
  id: "process.getJournal",
  tool: "process_get_journal",
  module: "process",
  minScope: "read",
  http: { method: "GET", path: "/process/journal" },
  title: "Get the Process journal",
  description: "Gets the user's Process Game journal — their saved learnings and conclusions/actions.",
  input: z.object({}),
  output: z.object({ learnings: z.array(z.string()), conclusions_actions: z.array(z.string()), updated_at: z.string().nullable() }),
  handler: async (ctx) => {
    const { rows } = await ctx.db.query(
      `select learnings, conclusions_actions, updated_at from public.process_game_journal where user_id = $1`,
      [ctx.principal.userId]
    );
    if (rows.length === 0) return { learnings: [], conclusions_actions: [], updated_at: null };
    return rows[0];
  },
});

export const processOperations = [processGetBoard, processGetJournal];
