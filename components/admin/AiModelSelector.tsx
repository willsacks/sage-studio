"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { saveAiModel } from "@/lib/actions/admin";
import { AVAILABLE_AI_MODELS } from "@/lib/ai/models";

interface AiModelSelectorProps {
  currentModel: string;
}

export function AiModelSelector({ currentModel }: AiModelSelectorProps) {
  const [model, setModel] = useState(currentModel);
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  function handleChange(next: string) {
    setModel(next);
    startTransition(async () => {
      await saveAiModel(next);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    });
  }

  const selected = AVAILABLE_AI_MODELS.find((m) => m.id === model);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
      <select
        value={model}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="flex-1 max-w-xs px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
      >
        {AVAILABLE_AI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
      {selected && <p className="text-xs text-[var(--muted-foreground)] flex-1">{selected.blurb}</p>}
      <div className="w-4 flex justify-end">
        {pending ? (
          <Loader2 size={13} className="animate-spin text-[var(--muted-foreground)]" />
        ) : justSaved ? (
          <Check size={13} className="text-[var(--primary)]" />
        ) : null}
      </div>
    </div>
  );
}
