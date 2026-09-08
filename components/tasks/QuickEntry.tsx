"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Check } from "lucide-react";
import { addManualEntry, type CategorySelection } from "@/lib/actions/time-entries";
import { CategoryPicker, type ClientOption } from "./CategoryPicker";

function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // "1h 30m" or "1h30m" or "1.5h"
  const hm = s.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|ours?)?\s*(?:(\d+)\s*m(?:in)?)?$/);
  if (hm) {
    const h = parseFloat(hm[1]);
    const m = hm[2] ? parseInt(hm[2]) : 0;
    return Math.round((h * 60 + m) * 60);
  }
  // "45m" or "45 min"
  const mOnly = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?$/);
  if (mOnly) return Math.round(parseFloat(mOnly[1]) * 60);
  // "1:30"
  const colon = s.match(/^(\d+):(\d{2})$/);
  if (colon) return (parseInt(colon[1]) * 60 + parseInt(colon[2])) * 60;
  // plain number — treat as hours
  const plain = s.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) return Math.round(parseFloat(plain[1]) * 3600);

  return null;
}

interface QuickEntryProps {
  clients: ClientOption[];
  onClientCreated: (client: ClientOption) => void;
  onMutated: () => void;
}

export function QuickEntry({ clients, onClientCreated, onMutated }: QuickEntryProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [durationError, setDurationError] = useState(false);
  const [category, setCategory] = useState<CategorySelection>({ category: null, client_id: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const descRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => descRef.current?.focus(), 50);
  }

  function handleClose() {
    setOpen(false);
    setDescription("");
    setDurationInput("");
    setDurationError(false);
    setCategory({ category: null, client_id: null });
    setError(null);
  }

  function handleSubmit() {
    const secs = parseDuration(durationInput);
    if (!secs || secs <= 0) {
      setDurationError(true);
      return;
    }
    setDurationError(false);
    setError(null);
    startTransition(async () => {
      try {
        const result = await addManualEntry(description, secs, new Date().toISOString(), category);
        if (result?.error) {
          setError(result.error);
        } else {
          handleClose();
          onMutated();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add entry.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mx-auto py-1"
      >
        <Plus size={13} />
        Log past time
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 sm:px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={descRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") handleClose(); }}
          placeholder="What did you work on?"
          className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-[var(--muted-foreground)] text-[var(--foreground)]"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={durationInput}
            onChange={(e) => { setDurationInput(e.target.value); setDurationError(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") handleClose(); }}
            placeholder="1h 30m"
            className={`w-24 bg-[var(--accent)] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] ${
              durationError ? "ring-1 ring-red-400" : ""
            }`}
          />
          {durationError && (
            <span className="text-xs text-red-400">try "1h 30m" or "45m"</span>
          )}
        </div>

        <CategoryPicker
          value={category}
          onChange={setCategory}
          clients={clients}
          onClientCreated={onClientCreated}
        />

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !durationInput.trim()}
            className="flex items-center gap-1 text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Check size={12} /> {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
