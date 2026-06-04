"use client";

import { useState, useTransition, useRef } from "react";
import { Lightbulb, Zap, Trash2, Plus } from "lucide-react";
import { saveJournal } from "@/lib/actions/process-game-journal";

type Accent = "amber" | "emerald";

const ACCENT = {
  amber: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-500",
    bullet: "bg-amber-400",
    inputFocus: "focus:border-amber-300",
    addHover: "hover:text-amber-500 hover:border-amber-300",
    countBg: "bg-amber-50 text-amber-600",
  },
  emerald: {
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    bullet: "bg-emerald-400",
    inputFocus: "focus:border-emerald-300",
    addHover: "hover:text-emerald-600 hover:border-emerald-300",
    countBg: "bg-emerald-50 text-emerald-700",
  },
} as const;

function ItemList({
  items,
  onChange,
  accent,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  accent: Accent;
  placeholder: string;
}) {
  const a = ACCENT[accent];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  function commitEdit(index: number, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      onChange(items.filter((_, i) => i !== index));
    } else {
      onChange(items.map((item, i) => (i === index ? trimmed : item)));
    }
    setEditingIndex(null);
  }

  function addItem() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setNewValue("");
    setTimeout(() => newInputRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-0.5">
      {items.map((item, i) =>
        editingIndex === i ? (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${a.bullet}`} />
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitEdit(i, editValue); }
                if (e.key === "Escape") setEditingIndex(null);
              }}
              onBlur={() => commitEdit(i, editValue)}
              className={`flex-1 text-sm bg-transparent border-b ${a.inputFocus} focus:outline-none py-0.5 transition-colors`}
            />
          </div>
        ) : (
          <div
            key={i}
            className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--accent)] transition-colors cursor-text"
            onClick={() => { setEditingIndex(i); setEditValue(item); }}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${a.bullet}`} />
            <span className="flex-1 text-sm leading-relaxed">{item}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(items.filter((_, j) => j !== i)); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      )}

      {/* New item row */}
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-[var(--border)] ${a.addHover} transition-colors group`}>
        <Plus size={13} className="flex-shrink-0 text-[var(--muted-foreground)] group-focus-within:opacity-0 transition-opacity absolute" />
        <div className="w-[13px] flex-shrink-0" />
        <input
          ref={newInputRef}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addItem(); }
            if (e.key === "Escape") setNewValue("");
          }}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-foreground)]/50"
        />
        {newValue.trim() && (
          <kbd className="text-[10px] text-[var(--muted-foreground)] border border-[var(--border)] rounded px-1 py-0.5 flex-shrink-0">
            ↵
          </kbd>
        )}
      </div>
    </div>
  );
}

interface Props {
  initialLearnings: string[];
  initialConclusions: string[];
}

export function Reflections({ initialLearnings, initialConclusions }: Props) {
  const [learnings, setLearnings] = useState(initialLearnings);
  const [conclusions, setConclusions] = useState(initialConclusions);
  const [, startTransition] = useTransition();

  // Use refs to always have the latest values when firing the server action
  const latestLearnings = useRef(learnings);
  const latestConclusions = useRef(conclusions);

  function handleLearningsChange(items: string[]) {
    latestLearnings.current = items;
    setLearnings(items);
    startTransition(async () => { await saveJournal(items, latestConclusions.current); });
  }

  function handleConclusionsChange(items: string[]) {
    latestConclusions.current = items;
    setConclusions(items);
    startTransition(async () => { await saveJournal(latestLearnings.current, items); });
  }

  return (
    <div className="space-y-0">
      {/* Learnings */}
      <div className="space-y-4 pt-8 border-t border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${ACCENT.amber.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Lightbulb size={17} className={ACCENT.amber.iconColor} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold leading-tight">Learnings</h2>
            <p className="text-xs text-[var(--muted-foreground)]">What have you discovered through the process?</p>
          </div>
          {learnings.length > 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCENT.amber.countBg}`}>
              {learnings.length}
            </span>
          )}
        </div>
        <ItemList
          items={learnings}
          onChange={handleLearningsChange}
          accent="amber"
          placeholder="Add a learning and press Enter…"
        />
      </div>

      {/* Conclusions & Actions */}
      <div className="space-y-4 pt-8 border-t border-[var(--border)] mt-8">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${ACCENT.emerald.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Zap size={17} className={ACCENT.emerald.iconColor} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold leading-tight">Conclusions & Actions</h2>
            <p className="text-xs text-[var(--muted-foreground)]">What will you do differently? What are you committing to?</p>
          </div>
          {conclusions.length > 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCENT.emerald.countBg}`}>
              {conclusions.length}
            </span>
          )}
        </div>
        <ItemList
          items={conclusions}
          onChange={handleConclusionsChange}
          accent="emerald"
          placeholder="Add a conclusion or action and press Enter…"
        />
      </div>
    </div>
  );
}
