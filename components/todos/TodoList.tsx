"use client";

import { useRef, useTransition } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { createTodo, toggleTodo, deleteTodo } from "@/lib/actions/todos";
import type { Tables } from "@/lib/db";

type Todo = Tables<"todos">;

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = inputRef.current?.value.trim();
    if (!title) return;
    if (inputRef.current) inputRef.current.value = "";
    startTransition(async () => {
      await createTodo(title);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          placeholder="Add a to-do..."
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </form>

      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        {initialTodos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
            No to-dos yet. Add one above!
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {initialTodos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 px-4 py-3 group">
                <button
                  onClick={() => startTransition(() => toggleTodo(todo.id, !todo.completed))}
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    todo.completed
                      ? "bg-[var(--primary)] border-[var(--primary)]"
                      : "border-[var(--border)] hover:border-[var(--primary)]"
                  }`}
                >
                  {todo.completed && (
                    <Check size={10} className="text-[var(--primary-foreground)]" />
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    todo.completed ? "line-through text-[var(--muted-foreground)]" : ""
                  }`}
                >
                  {todo.title}
                </span>
                <button
                  onClick={() => startTransition(() => deleteTodo(todo.id))}
                  className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
