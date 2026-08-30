"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddEntityChooser } from "./AddEntityChooser";
import type { FinanceEntity } from "./FinancesApp";

export function EntitySwitcher({
  entities,
  currentEntityId,
  onChange,
  onCreated,
}: {
  entities: FinanceEntity[];
  currentEntityId: string;
  onChange: (id: string) => void;
  onCreated: (entity: FinanceEntity) => void;
}) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <AddEntityChooser
        onClose={() => setAdding(false)}
        onCreated={(e) => {
          onCreated(e);
          setAdding(false);
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={currentEntityId}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm font-medium max-w-full truncate"
      >
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({e.entity_type === "personal" ? "Personal" : "Business"})
          </option>
        ))}
      </select>
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-2 py-1.5 flex-shrink-0"
      >
        <Plus size={14} /> Add entity
      </button>
    </div>
  );
}
