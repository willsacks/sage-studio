"use client";

import { useState, useRef, useEffect } from "react";
import { Tag, ChevronDown } from "lucide-react";
import type { CategorySelection } from "@/lib/actions/time-entries";

export const PRESET_CATEGORIES = [
  "Creative Work",
  "Life Admin",
  "Housework",
  "Travel",
  "Learning",
  "Exercise",
  "Social",
  "Rest",
];

interface CategoryPickerProps {
  value: CategorySelection;
  onChange: (sel: CategorySelection) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasValue = !!value.category;

  function select(sel: CategorySelection) {
    onChange(sel);
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ category: null });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
          hasValue
            ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--foreground)]"
            : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
        }`}
      >
        <Tag size={11} />
        <span className="max-w-[120px] truncate">{value.category ?? "Add category"}</span>
        {hasValue ? (
          <span
            onClick={clear}
            className="ml-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
            title="Clear"
          >
            ×
          </span>
        ) : (
          <ChevronDown size={11} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide border-b border-[var(--border)]">
            Categories
          </div>
          {PRESET_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => select({ category: cat })}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--accent)] transition-colors ${
                value.category === cat ? "text-[var(--primary)] font-medium" : "text-[var(--foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
