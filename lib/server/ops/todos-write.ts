import { z } from "zod";
import { defineOperation } from "@/lib/server/contract/operation";

const todoItem = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  due_date: z.string().nullable(),
  position: z.number(),
});

export const todosAdd = defineOperation({
  id: "todos.add",
  tool: "todos_add",
  module: "todos",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/todos" },
  title: "Add a to-do",
  description: "Creates a new to-do at the end of the user's list.",
  input: z.object({ title: z.string().min(1).max(500), dueDate: z.string().optional() }),
  output: todoItem,
  handler: async (ctx, input) => {
    const { rows } = await ctx.db.query(
      `insert into public.todos (user_id, title, due_date, position)
       values ($1, $2, $3, (select coalesce(max(position), -1) + 1 from public.todos where user_id = $1))
       returning id, title, completed, due_date, position`,
      [ctx.principal.userId, input.title.trim(), input.dueDate ?? null]
    );
    return rows[0];
  },
});

export const todosUpdate = defineOperation({
  id: "todos.update",
  tool: "todos_update",
  module: "todos",
  minScope: "write",
  mutates: true,
  http: { method: "POST", path: "/todos/:id" },
  title: "Update a to-do",
  description: "Edits a to-do's title, due date, and/or completed status. Only pass the fields you want to change.",
  input: z.object({
    id: z.string(),
    title: z.string().min(1).max(500).optional(),
    completed: z.boolean().optional(),
    dueDate: z.string().nullable().optional(),
  }),
  output: todoItem,
  handler: async (ctx, input) => {
    const sets: string[] = [];
    const params: unknown[] = [input.id, ctx.principal.userId];
    if (input.title !== undefined) { params.push(input.title.trim()); sets.push(`title = $${params.length}`); }
    if (input.completed !== undefined) { params.push(input.completed); sets.push(`completed = $${params.length}`); }
    if (input.dueDate !== undefined) { params.push(input.dueDate); sets.push(`due_date = $${params.length}`); }
    if (sets.length === 0) throw new Error("not_found");

    const { rows } = await ctx.db.query(
      `update public.todos set ${sets.join(", ")} where id = $1 and user_id = $2
       returning id, title, completed, due_date, position`,
      params
    );
    if (rows.length === 0) throw new Error("not_found");
    return rows[0];
  },
});

export const todosWriteOperations = [todosAdd, todosUpdate];
