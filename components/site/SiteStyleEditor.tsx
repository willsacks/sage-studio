"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { SiteStyleSelector } from "./SiteStyleSelector";
import { setSiteStyle, setSiteFontScale } from "@/lib/actions/sites";

const FONT_SCALES = [
  { value: 1, label: "Normal" },
  { value: 1.125, label: "Large" },
  { value: 1.25, label: "Larger" },
] as const;

interface SiteStyleEditorProps {
  siteId: string;
  currentStyleKey: string;
  currentFontScale?: number;
}

export function SiteStyleEditor({ siteId, currentStyleKey, currentFontScale = 1 }: SiteStyleEditorProps) {
  const [selectedKey, setSelectedKey] = useState(currentStyleKey);
  const [fontScale, setFontScale] = useState(currentFontScale);
  const [, startTransition] = useTransition();

  function handleSelect(styleKey: string) {
    setSelectedKey(styleKey);
    startTransition(async () => {
      const result = await setSiteStyle(siteId, styleKey);
      if (result.success) {
        toast.success("Style updated", { icon: <Check size={14} /> });
      }
    });
  }

  function handleFontScale(scale: number) {
    setFontScale(scale);
    startTransition(async () => {
      const result = await setSiteFontScale(siteId, scale);
      if (result.success) {
        toast.success("Text size updated", { icon: <Check size={14} /> });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">Text Size</p>
        <div className="flex gap-2">
          {FONT_SCALES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleFontScale(value)}
              className={cn(
                "px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                fontScale === value
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          Scales all text proportionally — useful for presets with fine serif fonts.
        </p>
      </div>

      <SiteStyleSelector selectedKey={selectedKey} onSelect={handleSelect} />
    </div>
  );
}
