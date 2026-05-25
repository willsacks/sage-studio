"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { updateTimeEntry, deleteTimeEntry, type CategorySelection } from "@/lib/actions/time-entries";
import { CategoryPicker } from "./CategoryPicker";

interface Entry {
  id: string;
  description: string;
  started_at: string;
  stopped_at: string;
  duration_seconds: number | null;
  category: string | null;
}

interface EditableTimeEntryProps {
  entry: Entry;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatTime(iso: string) {
  return format(new Date(iso), "h:mm a");
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditableTimeEntry({ entry }: EditableTimeEntryProps) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(entry.description);
  const [startedAt, setStartedAt] = useState(toDatetimeLocal(entry.started_at));
  const [stoppedAt, setStoppedAt] = useState(toDatetimeLocal(entry.stopped_at));
  const [category, setCategory] = useState<CategorySelection>({ category: entry.category });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    setDescription(entry.description);
    setStartedAt(toDatetimeLocal(entry.started_at));
    setStoppedAt(toDatetimeLocal(entry.stopped_at));
    setCategory({ category: entry.category });
    setError(null);
    setEditing(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateTimeEntry(entry.id, description, startedAt, stoppedAt, category);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTimeEntry(entry.id);
    });
  }

  if (editing) {
    return (
      <div className="px-4 py-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 space-y-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          autoFocus
          className="w-full bg-transparent text-sm focus:outline-none border-b border-[var(--border)] pb-1 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <span>Start</span>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <span>End</span>
            <input
              type="datetime-local"
              value={stoppedAt}
              onChange={(e) => setStoppedAt(e.target.value)}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleCancel}
            disabled={pending}
            className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors"
          >
            <X size={12} /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="flex items-center gap-1 text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Check size={12} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[var(--accent)] transition-colors group">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className={`text-sm truncate ${
          entry.description ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)] italic"
        }`}>
          {entry.description || "No description"}
        </p>
        {entry.category && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
            {entry.category}
          </span>
        )}
      </div>

      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0 hidden sm:block">
        {formatTime(entry.started_at)} – {formatTime(entry.stopped_at)}
      </span>

      <span className="font-mono text-sm font-medium text-[var(--foreground)] flex-shrink-0 w-20 text-right">
        {entry.duration_seconds != null ? formatDuration(entry.duration_seconds) : "—"}
      </span>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          title="Edit entry"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Delete entry"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
