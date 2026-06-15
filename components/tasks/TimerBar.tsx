"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square } from "lucide-react";
import {
  startTimer,
  stopTimer,
  updateTimerDescription,
  updateTimerCategory,
  type CategorySelection,
} from "@/lib/actions/time-entries";
import { CategoryPicker } from "./CategoryPicker";

export interface ActiveEntry {
  id: string;
  description: string;
  started_at: string;
  category?: string | null;
}

function formatElapsed(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TimerBarProps {
  activeEntry: ActiveEntry | null;
}

export function TimerBar({ activeEntry }: TimerBarProps) {
  const [isRunning, setIsRunning] = useState(!!activeEntry);
  const [entryId, setEntryId] = useState<string | null>(activeEntry?.id ?? null);
  const [description, setDescription] = useState(activeEntry?.description ?? "");
  const [category, setCategory] = useState<CategorySelection>({
    category: activeEntry?.category ?? null,
  });
  const [elapsed, setElapsed] = useState(() =>
    activeEntry
      ? Math.floor((Date.now() - new Date(activeEntry.started_at).getTime()) / 1000)
      : 0
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  async function handleStart() {
    setLoading(true);
    setError(null);
    const result = await startTimer(description, category);
    if (result.entry) {
      setEntryId(result.entry.id);
      setElapsed(0);
      setIsRunning(true);
    } else if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleStop() {
    if (!entryId) return;
    setLoading(true);
    clearTimeout(descDebounce.current);
    await stopTimer(entryId);
    setIsRunning(false);
    setElapsed(0);
    setEntryId(null);
    setDescription("");
    setCategory({ category: null });
    setLoading(false);
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    if (isRunning && entryId) {
      clearTimeout(descDebounce.current);
      descDebounce.current = setTimeout(() => {
        updateTimerDescription(entryId, value);
      }, 800);
    }
  }

  function handleCategoryChange(sel: CategorySelection) {
    setCategory(sel);
    if (isRunning && entryId) {
      updateTimerCategory(entryId, sel);
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-5 py-4 rounded-2xl border transition-colors ${
        isRunning
          ? "border-[var(--primary)]/30 bg-[var(--primary)]/5"
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
          isRunning ? "bg-red-500 animate-pulse" : "bg-[var(--border)]"
        }`}
      />

      <input
        value={description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !isRunning && !loading) handleStart(); }}
        placeholder="What are you working on?"
        className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-[var(--muted-foreground)] text-[var(--foreground)]"
      />

      <CategoryPicker value={category} onChange={handleCategoryChange} />

      <span
        className={`font-mono text-xl font-semibold tabular-nums flex-shrink-0 w-28 text-right transition-colors ${
          isRunning ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
        }`}
      >
        {formatElapsed(elapsed)}
      </span>

      <button
        onClick={isRunning ? handleStop : handleStart}
        disabled={loading}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 disabled:opacity-50 ${
          isRunning
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
        }`}
      >
        {isRunning
          ? <><Square size={13} fill="currentColor" /> Stop</>
          : <><Play size={13} fill="currentColor" /> Start</>
        }
      </button>

      {error && (
        <p className="w-full text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
