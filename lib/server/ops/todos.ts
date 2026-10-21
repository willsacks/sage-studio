import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";
import { Page, Limit } from "@/lib/server/contract/common";

const todoItem = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  due_date: z.string().nullable(),
  position: z.number(),
});

export const todosList = defineOperation({
  id: "todos.list",
  tool: "todos_list",
  module: "todos",
  minScope: "read",
  http: { method: "GET", path: "/todos" },
  title: "List to-dos",
  description: "List the user's to-dos, newest-position first. Pass completed:true/false to filter.",
  input: z.object({ completed: z.coerce.boolean().optional(), limit: Limit }),
  output: Page(todoItem),
  handler: async (ctx, input) => {
    const params: unknown[] = [ctx.principal.userId];
    let where = "user_id = $1";
    if (input.completed !== undefined) {
      params.push(input.completed);
      where += ` and completed = $${params.length}`;
    }
    params.push(input.limit);
    const { rows } = await ctx.db.query(
      `select id, title, completed, due_date, position from public.todos where ${where} order by position asc limit $${params.length}`,
      params
    );
    return { items: rows, next_cursor: null };
  },
});

export const todosOperations = [todosList];
