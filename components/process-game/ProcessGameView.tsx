"use client";

import { useState, useTransition } from "react";
import { Plus, Check } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { upsertCell, upsertSpot, createProgram, updateProgram, deleteProgram, reorderPrograms } from "@/lib/actions/process-game";
import { GameGrid } from "./GameGrid";
import { ProgramSection } from "./ProgramSection";
import { Reflections } from "./Reflections";
import { CELL_COLORS } from "./Cell";
import type { GameCell, Program, Spot } from "@/app/(dashboard)/process-game/page";

function SortableProgramSection(props: React.ComponentProps<typeof ProgramSection>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.program.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <ProgramSection {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

interface Props {
  cells: Record<number, GameCell>;
  programs: Program[];
  spotMap: Record<string, Record<number, Spot>>;
  learnings: string[];
  conclusionsActions: string[];
}

export function ProcessGameView({ cells: initialCells, programs: initialPrograms, spotMap: initialSpotMap, learnings, conclusionsActions }: Props) {
  const [cells, setCells] = useState(initialCells);
  const [programs, setPrograms] = useState(initialPrograms);
  const [spotMap, setSpotMap] = useState(initialSpotMap);
  const [addingProgram, setAddingProgram] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSpots, setNewSpots] = useState("10");
  const [newColor, setNewColor] = useState(CELL_COLORS[1]);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = programs.findIndex((p) => p.id === active.id);
    const newIndex = programs.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(programs, oldIndex, newIndex).map((p, i) => ({ ...p, position: i }));
    setPrograms(reordered);
    startTransition(async () => { await reorderPrograms(reordered.map((p) => p.id)); });
  }

  function handleCellSave(position: number, label: string, color: string | null) {
    setCells((prev) => {
      const next = { ...prev };
      const trimmed = label.trim();
      if (!trimmed && !color) {
        delete next[position];
      } else {
        next[position] = { position, label: trimmed || null, color };
      }
      return next;
    });
    startTransition(async () => { await upsertCell(position, label, color); });
  }

  function handleSpotSave(programId: string, position: number, label: string, color: string | null) {
    setSpotMap((prev) => {
      const programSpots = { ...(prev[programId] ?? {}) };
      const trimmed = label.trim();
      if (!trimmed && !color) {
        delete programSpots[position];
      } else {
        programSpots[position] = { program_id: programId, position, label: trimmed || null, color };
      }
      return { ...prev, [programId]: programSpots };
    });
    startTransition(async () => { await upsertSpot(programId, position, label, color); });
  }

  function handleProgramUpdate(id: string, name: string, totalSpots: number, color: string) {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, name, total_spots: totalSpots, color } : p)));
    startTransition(async () => { await updateProgram(id, name, totalSpots, color); });
  }

  function handleProgramDelete(id: string) {
    setPrograms((prev) => prev.filter((p) => p.id !== id));
    setSpotMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
    startTransition(async () => { await deleteProgram(id); });
  }

  function handleAddProgram() {
    const n = parseInt(newSpots, 10);
    if (!newName.trim() || isNaN(n) || n < 1) return;
    startTransition(async () => {
      const res = await createProgram(newName.trim(), n, newColor);
      if (res.program) {
        setPrograms((prev) => [...prev, res.program as unknown as Program]);
        setSpotMap((prev) => ({ ...prev, [res.program!.id]: {} }));
        setNewName("");
        setNewSpots("10");
        setNewColor(CELL_COLORS[1]);
        setAddingProgram(false);
      }
    });
  }

  const totalSpotsFilled = Object.values(spotMap)
    .flatMap((s) => Object.values(s))
    .filter((s) => s.label?.trim()).length;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Process Game</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Focus on the process. The results take care of themselves.
        </p>
      </div>

      {/* 100 Meeting Game */}
      <GameGrid cells={cells} onSave={handleCellSave} />

      {/* Spots divider */}
      <div className="space-y-8">
        <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-8">
          <h2 className="text-lg font-semibold">Spots</h2>
          {totalSpotsFilled > 0 && (
            <span className="text-sm text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--foreground)]">{totalSpotsFilled}</span> total filled
            </span>
          )}
        </div>

        {programs.length === 0 && !addingProgram && (
          <p className="text-sm text-[var(--muted-foreground)] -mt-4">
            Add programs below to track your yeses.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={programs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {programs.map((program) => (
              <SortableProgramSection
                key={program.id}
                program={program}
                spots={spotMap[program.id] ?? {}}
                onSpotSave={(pos, label, color) => handleSpotSave(program.id, pos, label, color)}
                onProgramUpdate={(name, total, color) => handleProgramUpdate(program.id, name, total, color)}
                onProgramDelete={() => handleProgramDelete(program.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add program */}
        {addingProgram ? (
          <div className="space-y-3 p-4 border border-[var(--border)] rounded-xl bg-[var(--card)]">
            <p className="text-sm font-medium">New program</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddProgram(); if (e.key === "Escape") setAddingProgram(false); }}
                placeholder="Program name (e.g. Guild, Path of Soul)"
                autoFocus
                className="flex-1 min-w-48 text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:text-[var(--muted-foreground)]"
              />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--muted-foreground)] flex-shrink-0">Spots</span>
                <input
                  type="number"
                  value={newSpots}
                  onChange={(e) => setNewSpots(e.target.value)}
                  min={1}
                  className="w-20 text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CELL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddProgram}
                disabled={pending || !newName.trim()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Check size={13} /> Add Program
              </button>
              <button
                onClick={() => setAddingProgram(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingProgram(true)}
            className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--muted-foreground)] transition-colors w-full justify-center"
          >
            <Plus size={15} /> Add Spots Program
          </button>
        )}
      </div>

      <Reflections initialLearnings={learnings} initialConclusions={conclusionsActions} />
    </div>
  );
}
