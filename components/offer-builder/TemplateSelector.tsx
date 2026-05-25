"use client";

import { useState } from "react";
import { Search, X, FileText, Sparkles } from "lucide-react";
import { useBuilderStore } from "@/lib/store/builder";
import type { OfferTemplate } from "@/lib/queries/offer-templates";
import type { PageData, PageTheme } from "@/lib/types/builder";
import { cn } from "@/lib/utils/cn";

type Tab = "all" | "platform" | "personal" | "promoted";

interface TemplateSelectorProps {
  onClose: () => void;
  templates: {
    platform: OfferTemplate[];
    personal: OfferTemplate[];
    promoted: OfferTemplate[];
  };
}

function TemplateCard({
  template,
  onUse,
  isDefault,
}: {
  template: OfferTemplate;
  onUse: () => void;
  isDefault?: boolean;
}) {
  return (
    <div className={cn(
      "group flex flex-col rounded-lg border overflow-hidden bg-[var(--card)] transition-colors",
      isDefault
        ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/40 hover:border-[var(--primary)]/70"
        : "border-[var(--border)] hover:border-[var(--primary)]"
    )}>
      {/* Thumbnail */}
      <div className="aspect-video bg-[var(--card)] flex items-center justify-center overflow-hidden relative">
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[var(--muted-foreground)]">
            <FileText size={32} />
            <span className="text-xs">{template.name}</span>
          </div>
        )}
        {isDefault && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-bold">
            <Sparkles size={9} /> Default
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--foreground)] leading-tight">
            {template.name}
          </p>
          {template.description && (
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
            {template.owner_type === "platform" ? "Platform" : template.is_promoted ? "Community" : "Personal"}
          </span>
          <button
            onClick={onUse}
            className="text-xs px-3 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-90 transition-colors"
          >
            Use This
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplateSelector({ onClose, templates }: TemplateSelectorProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const reset = useBuilderStore((s) => s.reset);
  const isDirty = useBuilderStore((s) => s.isDirty);
  const blocks = useBuilderStore((s) => s.blocks);

  const allTemplates = [
    ...templates.platform,
    ...templates.promoted,
    ...templates.personal,
  ];

  const filtered = (tab === "all" ? allTemplates
    : tab === "platform" ? templates.platform
    : tab === "personal" ? templates.personal
    : templates.promoted
  ).filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function handleUse(template: OfferTemplate) {
    if (isDirty && blocks.length > 0) {
      if (!confirm("This will replace your current page content. Continue?")) return;
    }
    reset(
      template.page_data as PageData,
      (template.theme as PageTheme | null) ?? undefined
    );
    onClose();
  }

  function handleStartBlank() {
    if (isDirty && blocks.length > 0) {
      if (!confirm("This will clear your current page. Continue?")) return;
    }
    reset([]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Choose a Starting Point</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Select a template or start from scratch</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={20} />
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 px-6 py-4 border-b border-[var(--border)]">
          <button
            onClick={handleStartBlank}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            <FileText size={16} /> Start from Scratch
          </button>
        </div>

        {/* Search + Tabs */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-[var(--border)]">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "platform", "personal", "promoted"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors",
                  tab === t
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {t === "promoted" ? "Community" : t}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted-foreground)]">
              <Sparkles size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={() => handleUse(template)}
                  isDefault={template.template_key === "platform_default"}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
