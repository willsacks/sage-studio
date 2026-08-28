"use client";

import { useState } from "react";
import { Loader2, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFinanceEntity } from "@/lib/actions/finance-entities";
import type { FinanceEntity } from "./FinancesApp";

export function CreateEntityForm({ onCreated }: { onCreated: (entity: FinanceEntity) => void }) {
  const [entityType, setEntityType] = useState<"personal" | "business">("personal");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Give it a name");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await createFinanceEntity({ name: name.trim(), entityType });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated({ id: result.entityId!, name: name.trim(), entity_type: entityType, currency: "USD", fiscal_year_start_month: 1 });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] p-6 max-w-lg space-y-4">
      <div>
        <h2 className="font-semibold">Set up your books</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Start with a personal or business set of books. You can add more of either later — an artist with a side business can track both separately.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setEntityType("personal")}
          className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
            entityType === "personal" ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] hover:bg-[var(--accent)]/50"
          }`}
        >
          <User size={20} /> Personal
        </button>
        <button
          onClick={() => setEntityType("business")}
          className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
            entityType === "business" ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] hover:bg-[var(--accent)]/50"
          }`}
        >
          <Briefcase size={20} /> Business
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={entityType === "personal" ? "Personal" : "e.g. My Studio LLC"}
          className="h-9 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button onClick={handleCreate} disabled={creating || !name.trim()}>
        {creating && <Loader2 size={14} className="animate-spin mr-1.5" />}
        Create
      </Button>
    </div>
  );
}
