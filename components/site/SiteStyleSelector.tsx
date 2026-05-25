"use client";

import { useState, useMemo } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { THEMES } from "@/lib/styles";
import type { StyleCategoryFilter } from "@/lib/styles/types";

const CATEGORIES: StyleCategoryFilter[] = ["All", "Music", "Visual Art", "Literary & Film", "Universal"];

interface SiteStyleSelectorProps {
  selectedKey: string;
  onSelect: (styleKey: string) => void;
}

export function SiteStyleSelector({ selectedKey, onSelect }: SiteStyleSelectorProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<StyleCategoryFilter>("All");

  const filtered = useMemo(() =>
    THEMES.filter((t) => {
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "All" || t.category === category;
      return matchesSearch && matchesCategory;
    }),
    [search, category]
  );

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search aesthetics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                category === cat
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">
          No styles match — <button type="button" onClick={() => { setSearch(""); setCategory("All"); }} className="text-[var(--primary)] hover:underline">clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((style) => {
            const isSelected = style.styleKey === selectedKey;
            const { tokens } = style;
            return (
              <button
                key={style.styleKey}
                type="button"
                onClick={() => onSelect(style.styleKey)}
                className={cn(
                  "group relative flex flex-col rounded-xl overflow-hidden border-2 text-left transition-all duration-150",
                  isSelected
                    ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-2"
                    : "border-[var(--border)] hover:border-[var(--primary)]/50"
                )}
              >
                {/* Thumbnail */}
                <div className="relative h-28 w-full overflow-hidden bg-[var(--muted)]">
                  <img
                    src={`/style-thumbnails/${style.styleKey}.svg`}
                    alt={style.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-[var(--primary)]/20 flex items-center justify-center">
                      <div className="bg-[var(--primary)] text-[var(--primary-foreground)] rounded-full p-1">
                        <Check size={14} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5 bg-[var(--card)]">
                  <p className="text-xs font-semibold text-[var(--card-foreground)] truncate">{style.name}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 line-clamp-1">{style.description}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[tokens.colorBackground, tokens.colorAccent, tokens.colorText].map((color, i) => (
                      <div key={i} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                    ))}
                    <span className="text-[9px] text-[var(--muted-foreground)] ml-0.5 truncate">{tokens.fontDisplay}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
