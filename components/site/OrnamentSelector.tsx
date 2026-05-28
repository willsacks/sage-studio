"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { ORNAMENT_PRESETS, DEFAULT_ORNAMENT_KEY } from "@/lib/ornaments";
import { setSiteOrnamentation } from "@/lib/actions/sites";
import { cn } from "@/lib/utils/cn";

interface OrnamentSelectorProps {
  siteId: string;
  currentKey: string;
}

export function OrnamentSelector({ siteId, currentKey }: OrnamentSelectorProps) {
  const [selected, setSelected] = useState(currentKey);
  const [isPending, startTransition] = useTransition();

  function handleSelect(key: string) {
    setSelected(key);
    startTransition(async () => {
      await setSiteOrnamentation(siteId, key);
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {ORNAMENT_PRESETS.map((preset) => {
        const isActive = selected === preset.key;
        return (
          <button
            key={preset.key}
            onClick={() => handleSelect(preset.key)}
            disabled={isPending}
            className={cn(
              "relative flex flex-col items-center gap-2 p-3 rounded-xl border text-left transition-all",
              isActive
                ? "border-[var(--primary)] bg-[var(--accent)] ring-1 ring-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]/50"
            )}
          >
            {isActive && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <Check size={9} className="text-[var(--primary-foreground)]" />
              </div>
            )}

            {/* Preview */}
            <div className="w-full flex flex-col items-center gap-1 py-1">
              <span className="text-xl leading-none" style={{ fontFamily: "serif", opacity: preset.key === "none" ? 0.15 : 0.85 }}>
                {preset.tokens.dividerChar === " " ? "·" : preset.tokens.dividerChar}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)] tracking-widest">
                {preset.tokens.bulletChar} · {preset.tokens.bulletChar}
              </span>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold leading-tight">{preset.label}</p>
              <p className="text-[10px] text-[var(--muted-foreground)] leading-tight mt-0.5 line-clamp-2">{preset.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
