"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

export const CELL_COLORS = [
  "#64748B", "#8B5CF6", "#F59E0B", "#F97316", "#10B981",
  "#3B82F6", "#EC4899", "#EF4444", "#06B6D4", "#84CC16",
];

function textColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#1a1a1a" : "#ffffff";
}

interface CellProps {
  position: number;
  label: string | null;
  color: string | null;
  milestone?: string;
  onSave: (label: string, color: string | null) => void;
}

export function Cell({ position, label, color, milestone, onSave }: CellProps) {
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const [draftColor, setDraftColor] = useState<string | null>(color);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when parent data changes (e.g. after server round-trip)
  useEffect(() => {
    if (!active) {
      setDraft(label ?? "");
      setDraftColor(color);
    }
  }, [label, color, active]);

  useEffect(() => {
    if (active) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [active]);

  function handleActivate() {
    setDraft(label ?? "");
    setDraftColor(color);
    setActive(true);
  }

  function handleSave() {
    setActive(false);
    onSave(draft, draftColor);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setActive(false);
      setDraft(label ?? "");
      setDraftColor(color);
    }
  }

  const displayColor = active ? draftColor : color;
  const filled = !!(label && label.trim());

  const cellStyle: React.CSSProperties = displayColor
    ? { backgroundColor: displayColor, color: textColor(displayColor), borderColor: "transparent" }
    : {};

  // Align color strip away from right edge (columns 9 & 10 in a 10-col grid)
  const col = position % 10; // 0 = col 10
  const stripAlignRight = col === 0 || col === 9;

  return (
    <div className="relative">
      {/* Cell */}
      <div
        className={`aspect-square w-full rounded-lg border text-[11px] transition-colors cursor-pointer relative overflow-hidden ${
          active
            ? "ring-2 ring-[var(--primary)] ring-offset-1 border-transparent"
            : filled || displayColor
            ? "border-transparent hover:brightness-95"
            : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--accent)]/50"
        }`}
        style={cellStyle}
        onClick={!active ? handleActivate : undefined}
      >
        {/* Milestone badge */}
        {milestone && (
          <span className="absolute top-0.5 right-0.5 z-10 text-[8px] font-bold leading-none bg-[var(--primary)] text-[var(--primary-foreground)] rounded px-1 py-px">
            {milestone}
          </span>
        )}

        {active ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-[11px] text-center p-1 leading-tight focus:outline-none"
            style={{ color: draftColor ? textColor(draftColor) : "inherit" }}
          />
        ) : filled ? (
          <span className="absolute inset-0 flex items-center justify-center p-1 text-center leading-tight break-words hyphens-auto overflow-hidden text-[11px]">
            {label}
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)] font-mono text-[10px]">
            {position}
          </span>
        )}
      </div>

      {/* Color strip — appears below active cell */}
      {active && (
        <div
          className="absolute z-30 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl p-1.5 flex gap-1 flex-wrap"
          style={stripAlignRight ? { right: 0 } : { left: 0 }}
        >
          {/* Clear color */}
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); setDraftColor(null); }}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center bg-[var(--muted)] flex-shrink-0 ${
              draftColor === null ? "border-[var(--primary)]" : "border-[var(--border)]"
            }`}
          >
            <X size={9} />
          </button>
          {CELL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); setDraftColor(c); }}
              className="w-5 h-5 rounded-full flex-shrink-0 transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: c,
                outline: draftColor === c ? `2px solid ${c}` : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
