import { CheckSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodos } from "@/lib/queries/todos";
import { TodoBoard } from "@/components/todos/TodoBoard";

export const metadata = { title: "To Do's" };

export default async function TodosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todos = await getTodos();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: activeRaw } = await db
    .from("time_entries")
    .select("id, todo_id")
    .eq("user_id", user.id)
    .is("stopped_at", null)
    .maybeSingle();

  const activeTimer = activeRaw?.todo_id ? { id: activeRaw.id as string, todoId: activeRaw.todo_id as string } : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckSquare size={22} /> To Do&apos;s
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Track your personal tasks.
        </p>
      </div>
      <TodoBoard initialTodos={todos} initialActiveTimer={activeTimer} />
    </div>
  );
}
