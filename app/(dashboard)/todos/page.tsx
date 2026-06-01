import { CheckSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodos } from "@/lib/queries/todos";
import { TodoList } from "@/components/todos/TodoList";

export const metadata = { title: "To Do's" };

export default async function TodosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todos = await getTodos();

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
      <TodoList initialTodos={todos} />
    </div>
  );
}
