"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { Plus, Trash2, Check, GripVertical, X } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createTodo, toggleTodo, deleteTodo, moveTodo } from "@/lib/actions/todos";
import type { Tables } from "@/lib/db";

type Todo = Tables<"todos">;

type Section = {
  key: string;
  label: string;
  dateLabel: string | null;
  dueDate: string | null;
  match: (dueDate: string | null) => boolean;
};

function buildSections(): Section[] {
  const today = startOfDay(new Date());
  const sections: Section[] = [];

  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const dStr = format(d, "yyyy-MM-dd");
    sections.push({
      key: dStr,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEEE"),
      dateLabel: format(d, "MMM d"),
      dueDate: dStr,
      match: i === 0 ? (due) => due !== null && due <= dStr : (due) => due === dStr,
    });
  }

  const nextWeekStart = format(addDays(today, 7), "yyyy-MM-dd");
  const nextWeekEnd = format(addDays(today, 13), "yyyy-MM-dd");
  sections.push({
    key: "next-week",
    label: "Next Week",
    dateLabel: null,
    dueDate: nextWeekStart,
    match: (due) => due !== null && due >= nextWeekStart && due <= nextWeekEnd,
  });

  sections.push({
    key: "backlog",
    label: "Backlog",
    dateLabel: null,
    dueDate: null,
    match: (due) => due === null || due > nextWeekEnd,
  });

  return sections;
}

function computePosition(items: Todo[], index: number): number {
  const prev = items[index - 1];
  const next = items[index + 1];
  if (!prev && !next) return 1000;
  if (!prev) return next.position - 1;
  if (!next) return prev.position + 1;
  return (prev.position + next.position) / 2;
}

export function TodoBoard({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState(initialTodos);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sections = useMemo(buildSections, []);

  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const s of sections) map.set(s.key, []);
    for (const todo of todos) {
      const section = sections.find((s) => s.match(todo.due_date)) ?? sections[sections.length - 1];
      map.get(section.key)!.push(todo);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [todos, sections]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const sourceSection = sections.find((s) => grouped.get(s.key)!.some((t) => t.id === activeIdStr));
    if (!sourceSection) return;

    let targetSection = sections.find((s) => s.key === overIdStr);
    let overIndex: number | null = null;
    if (!targetSection) {
      targetSection = sections.find((s) => grouped.get(s.key)!.some((t) => t.id === overIdStr));
      if (targetSection) {
        overIndex = grouped.get(targetSection.key)!.findIndex((t) => t.id === overIdStr);
      }
    }
    if (!targetSection) return;

    const sourceItems = grouped.get(sourceSection.key)!;
    const activeTodo = sourceItems.find((t) => t.id === activeIdStr);
    if (!activeTodo) return;

    const targetItems = grouped.get(targetSection.key)!.filter((t) => t.id !== activeIdStr);
    const insertIndex = overIndex !== null ? overIndex : targetItems.length;
    targetItems.splice(insertIndex, 0, activeTodo);

    const newPosition = computePosition(targetItems, insertIndex);
    const newDueDate = targetSection.dueDate;

    setTodos((prev) =>
      prev.map((t) => (t.id === activeIdStr ? { ...t, due_date: newDueDate, position: newPosition } : t))
    );
    startTransition(() => {
      moveTodo(activeIdStr, newDueDate, newPosition);
    });
  }

  function handleAdd(section: Section, title: string) {
    const items = grouped.get(section.key)!;
    const position = items.length > 0 ? items[items.length - 1].position + 1 : 1000;
    const optimistic: Todo = {
      id: `temp-${crypto.randomUUID()}`,
      user_id: "",
      title,
      completed: false,
      due_date: section.dueDate,
      position,
      created_at: new Date().toISOString(),
    };
    setTodos((prev) => [...prev, optimistic]);
    startTransition(async () => {
      await createTodo(title, section.dueDate, position);
    });
  }

  function handleToggle(todo: Todo) {
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)));
    startTransition(() => {
      toggleTodo(todo.id, !todo.completed);
    });
  }

  function handleDelete(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    startTransition(() => {
      deleteTodo(id);
    });
  }

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) ?? null : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {sections.map((section) => (
          <SectionColumn
            key={section.key}
            section={section}
            items={grouped.get(section.key)!}
            onAdd={(title) => handleAdd(section, title)}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTodo ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
            <GripVertical size={14} className="text-[var(--muted-foreground)]" />
            <span className="text-sm">{activeTodo.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SectionColumn({
  section,
  items,
  onAdd,
  onToggle,
  onDelete,
}: {
  section: Section;
  items: Todo[];
  onAdd: (title: string) => void;
  onToggle: (todo: Todo) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: section.key });
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = inputRef.current?.value.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    onAdd(title);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--muted)]/30">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold">{section.label}</h3>
          {section.dateLabel && (
            <span className="text-xs text-[var(--muted-foreground)]">{section.dateLabel}</span>
          )}
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          title="Add task"
        >
          <Plus size={14} />
        </button>
      </div>

      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`min-h-[8px] transition-colors ${isOver ? "bg-[var(--accent)]/40" : ""}`}>
          {items.length === 0 && !adding ? (
            <p className="px-4 py-3 text-xs text-[var(--muted-foreground)]">No tasks</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {items.map((todo) => (
                <SortableTodoRow key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      </SortableContext>

      {adding && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2 border-t border-[var(--border)]">
          <input
            ref={inputRef}
            autoFocus
            placeholder="Add a task..."
            onBlur={() => {
              if (!inputRef.current?.value.trim()) setAdding(false);
            }}
            className="flex-1 px-2 py-1 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
          />
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </form>
      )}
    </div>
  );
}

function SortableTodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-2 py-2 group">
      <button
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-6 h-6 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-grab touch-none flex-shrink-0"
      >
        <GripVertical size={14} />
      </button>
      <button
        onClick={() => onToggle(todo)}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          todo.completed
            ? "bg-[var(--primary)] border-[var(--primary)]"
            : "border-[var(--border)] hover:border-[var(--primary)]"
        }`}
      >
        {todo.completed && <Check size={10} className="text-[var(--primary-foreground)]" />}
      </button>
      <span className={`flex-1 text-sm ${todo.completed ? "line-through text-[var(--muted-foreground)]" : ""}`}>
        {todo.title}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-red-500 transition-all flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
