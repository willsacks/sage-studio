"use client";

import { Cell } from "./Cell";
import type { GameCell } from "@/app/(dashboard)/process-game/page";

const MILESTONES: Record<number, string> = {
  25: "¼",
  50: "½",
  75: "¾",
  100: "★",
};

interface Props {
  cells: Record<number, GameCell>;
  onSave: (position: number, label: string, color: string | null) => void;
}

export function GameGrid({ cells, onSave }: Props) {
  const filled = Object.values(cells).filter((c) => c.label?.trim()).length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">100 Meeting Game</h2>
        <span className="text-sm text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">{filled}</span> / 100
        </span>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((pos) => (
          <Cell
            key={pos}
            position={pos}
            label={cells[pos]?.label ?? null}
            color={cells[pos]?.color ?? null}
            milestone={MILESTONES[pos]}
            onSave={(label, color) => onSave(pos, label, color)}
          />
        ))}
      </div>
    </section>
  );
}
