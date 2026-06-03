"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check } from "lucide-react";
import { Cell, CELL_COLORS } from "./Cell";
import type { Program, Spot } from "@/app/(dashboard)/process-game/page";

interface Props {
  program: Program;
  spots: Record<number, Spot>;
  onSpotSave: (position: number, label: string, color: string | null) => void;
  onProgramUpdate: (name: string, totalSpots: number, color: string) => void;
  onProgramDelete: () => void;
}

export function ProgramSection({ program, spots, onSpotSave, onProgramUpdate, onProgramDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(program.name);
  const [editSpots, setEditSpots] = useState(String(program.total_spots));
  const [editColor, setEditColor] = useState(program.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  const filled = Object.values(spots).filter((s) => s.label?.trim()).length;

  function handleSave() {
    const n = parseInt(editSpots, 10);
    if (!editName.trim() || isNaN(n) || n < 1) return;
    onProgramUpdate(editName.trim(), n, editColor);
    setEditing(false);
    setConfirmDelete(false);
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(() => { onProgramDelete(); });
  }

  return (
    <section className="space-y-2">
      {editing ? (
        <div className="flex items-center gap-3 flex-wrap pb-1">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="text-sm font-semibold bg-transparent border-b-2 border-[var(--primary)] focus:outline-none flex-1 min-w-32 py-0.5"
            autoFocus
          />
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <span>Spots</span>
            <input
              type="number"
              value={editSpots}
              onChange={(e) => setEditSpots(e.target.value)}
              min={1}
              className="w-16 text-sm bg-[var(--input)] border border-[var(--border)] rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
          <div className="flex gap-1">
            {CELL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{ backgroundColor: c, outline: editColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              <Check size={11} /> Save
            </button>
            <button
              onClick={() => { setEditing(false); setConfirmDelete(false); }}
              className="text-xs px-2.5 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: program.color }} />
          <h3 className="text-base font-semibold flex-1">{program.name}</h3>
          <span className="text-sm text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">{filled}</span> / {program.total_spots}
          </span>
          <button
            onClick={() => {
              setEditName(program.name);
              setEditSpots(String(program.total_spots));
              setEditColor(program.color);
              setEditing(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleDelete}
            className={`transition-opacity p-1 rounded-md ${
              confirmDelete
                ? "opacity-100 text-[var(--destructive)] bg-[var(--destructive)]/10"
                : "opacity-0 group-hover:opacity-100 hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
            }`}
          >
            <Trash2 size={13} />
          </button>
          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {Array.from({ length: program.total_spots }, (_, i) => i + 1).map((pos) => (
          <Cell
            key={pos}
            position={pos}
            label={spots[pos]?.label ?? null}
            color={spots[pos]?.color ?? null}
            onSave={(label, color) => onSpotSave(pos, label, color)}
          />
        ))}
      </div>
    </section>
  );
}
