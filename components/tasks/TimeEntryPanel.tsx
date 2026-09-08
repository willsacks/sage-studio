"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Play, Square, Check } from "lucide-react";
import {
  startTimer,
  stopTimer,
  updateTimerDescription,
  updateTimerCategory,
  addManualEntry,
  type CategorySelection,
} from "@/lib/actions/time-entries";
import { CategoryPicker, type ClientOption } from "./CategoryPicker";

export interface ActiveEntry {
  id: string;
  description: string;
  started_at: string;
  category?: string | null;
  client_id?: string | null;
}

function formatElapsed(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const hm = s.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|ours?)?\s*(?:(\d+)\s*m(?:in)?)?$/);
  if (hm) return Math.round((parseFloat(hm[1]) * 60 + (hm[2] ? parseInt(hm[2]) : 0)) * 60);
  const mOnly = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?$/);
  if (mOnly) return Math.round(parseFloat(mOnly[1]) * 60);
  const colon = s.match(/^(\d+):(\d{2})$/);
  if (colon) return (parseInt(colon[1]) * 60 + parseInt(colon[2])) * 60;
  const plain = s.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) return Math.round(parseFloat(plain[1]) * 3600);
  return null;
}

interface TimeEntryPanelProps {
  activeEntry: ActiveEntry | null;
  clients: ClientOption[];
  onClientCreated: (client: ClientOption) => void;
  onMutated: () => void;
}

export function TimeEntryPanel({ activeEntry, clients, onClientCreated, onMutated }: TimeEntryPanelProps) {
  const [tab, setTab] = useState<"timer" | "log">("timer");

  // ── Timer state ──────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(!!activeEntry);
  const [entryId, setEntryId] = useState<string | null>(activeEntry?.id ?? null);
  const [timerDesc, setTimerDesc] = useState(activeEntry?.description ?? "");
  const [timerCat, setTimerCat] = useState<CategorySelection>({
    category: activeEntry?.category ?? null,
    client_id: activeEntry?.client_id ?? null,
  });
  const [elapsed, setElapsed] = useState(() =>
    activeEntry ? Math.floor((Date.now() - new Date(activeEntry.started_at).getTime()) / 1000) : 0
  );
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const descDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  async function handleStart() {
    setTimerLoading(true);
    setTimerError(null);
    const result = await startTimer(timerDesc, timerCat);
    if (result.entry) {
      setEntryId(result.entry.id);
      setElapsed(0);
      setIsRunning(true);
      onMutated();
    } else if (result.error) {
      setTimerError(result.error);
    }
    setTimerLoading(false);
  }

  async function handleStop() {
    if (!entryId) return;
    setTimerLoading(true);
    clearTimeout(descDebounce.current);
    await stopTimer(entryId);
    setIsRunning(false);
    setElapsed(0);
    setEntryId(null);
    setTimerDesc("");
    setTimerCat({ category: null, client_id: null });
    onMutated();
    setTimerLoading(false);
  }

  function handleTimerDescChange(value: string) {
    setTimerDesc(value);
    if (isRunning && entryId) {
      clearTimeout(descDebounce.current);
      descDebounce.current = setTimeout(() => updateTimerDescription(entryId, value), 800);
    }
  }

  function handleTimerCatChange(sel: CategorySelection) {
    setTimerCat(sel);
    if (isRunning && entryId) updateTimerCategory(entryId, sel);
  }

  // ── Log state ────────────────────────────────────────────────────────────
  const [logDesc, setLogDesc] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [durationError, setDurationError] = useState(false);
  const [logCat, setLogCat] = useState<CategorySelection>({ category: null, client_id: null });
  const [logError, setLogError] = useState<string | null>(null);
  const [logPending, startLogTransition] = useTransition();
  const logDescRef = useRef<HTMLInputElement>(null);

  function switchTab(t: "timer" | "log") {
    setTab(t);
    if (t === "log") setTimeout(() => logDescRef.current?.focus(), 50);
  }

  function handleLogSubmit() {
    const secs = parseDuration(durationInput);
    if (!secs || secs <= 0) { setDurationError(true); return; }
    setDurationError(false);
    setLogError(null);
    startLogTransition(async () => {
      try {
        const result = await addManualEntry(logDesc, secs, new Date().toISOString(), logCat);
        if (result?.error) {
          setLogError(result.error);
        } else {
          setLogDesc("");
          setDurationInput("");
          setLogCat({ category: null, client_id: null });
          setTab("timer");
          onMutated();
        }
      } catch (err) {
        setLogError(err instanceof Error ? err.message : "Failed to add entry.");
      }
    });
  }

  const isTimer = tab === "timer";

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isTimer && isRunning
          ? "border-[var(--primary)]/30 bg-[var(--primary)]/5"
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)]">
        {(["timer", "log"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors first:rounded-tl-2xl last:rounded-tr-2xl ${
              tab === t
                ? "text-[var(--foreground)] border-b-2 border-[var(--primary)] -mb-px"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "timer" ? "Timer" : "Log past time"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="px-4 sm:px-5 py-4">
        {isTimer ? (
          <>
            <div className="flex items-center gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
                  isRunning ? "bg-red-500 animate-pulse" : "bg-[var(--border)]"
                }`}
              />
              <input
                value={timerDesc}
                onChange={(e) => handleTimerDescChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !isRunning && !timerLoading) handleStart(); }}
                placeholder="What are you working on?"
                className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-[var(--muted-foreground)] text-[var(--foreground)]"
              />
              <CategoryPicker value={timerCat} onChange={handleTimerCatChange} clients={clients} onClientCreated={onClientCreated} />
            </div>
            <div className="flex items-center justify-between mt-3 gap-3">
              <span
                className={`font-mono text-2xl font-semibold tabular-nums transition-colors ${
                  isRunning ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                }`}
              >
                {formatElapsed(elapsed)}
              </span>
              <button
                onClick={isRunning ? handleStop : handleStart}
                disabled={timerLoading}
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
            </div>
            {timerError && <p className="mt-2 text-xs text-red-500">{timerError}</p>}
          </>
        ) : (
          <>
            <input
              ref={logDescRef}
              type="text"
              value={logDesc}
              onChange={(e) => setLogDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogSubmit(); }}
              placeholder="What did you work on?"
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[var(--muted-foreground)] text-[var(--foreground)]"
            />
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={durationInput}
                  onChange={(e) => { setDurationInput(e.target.value); setDurationError(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLogSubmit(); }}
                  placeholder="1h 30m"
                  className={`w-24 bg-[var(--accent)] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] ${
                    durationError ? "ring-1 ring-red-400" : ""
                  }`}
                />
                {durationError && <span className="text-xs text-red-400">try "1h 30m" or "45m"</span>}
              </div>
              <CategoryPicker value={logCat} onChange={setLogCat} clients={clients} onClientCreated={onClientCreated} />
              <button
                type="button"
                onClick={handleLogSubmit}
                disabled={logPending || !durationInput.trim()}
                className="flex items-center gap-1 ml-auto text-sm font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Check size={13} /> {logPending ? "Adding…" : "Add"}
              </button>
            </div>
            {logError && <p className="mt-2 text-xs text-red-500">{logError}</p>}
          </>
        )}
      </div>
    </div>
  );
}
