"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, FileText, Sparkles, Home, User, Grid3x3, Mail, ShoppingBag, Code2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { addSitePage } from "@/lib/actions/sites";
import { createHtmlPage, applyCustomStyle } from "@/lib/actions/html-pages";
import { extractStyleFromHtml } from "@/lib/utils/extract-html-style";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY } from "@/lib/styles";
import type { StyleTokens } from "@/lib/styles/types";
import type { OfferTemplate } from "@/lib/queries/offer-templates";
import type { PageData, PageTheme } from "@/lib/types/builder";
import {
  LayoutPreview,
  HOME_TEMPLATES,
  ABOUT_TEMPLATES,
  WORK_TEMPLATES,
  CONTACT_TEMPLATES,
  type SitePageTemplate,
} from "./page-templates";

// ─── Types ────────────────────────────────────────────────────────────────────

type Selection =
  | { kind: "site-template"; template: SitePageTemplate }
  | { kind: "custom" }
  | { kind: "html-import" }
  | { kind: "offer-blank" }
  | { kind: "offer-template"; template: OfferTemplate };

interface PageTypePickerProps {
  siteId: string;
  existingTypes: ("home" | "about" | "work" | "contact" | "custom")[];
  templates?: { platform: OfferTemplate[]; personal: OfferTemplate[] };
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[var(--muted-foreground)]">{icon}</span>
      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  preview,
  name,
  description,
  isSelected,
  badge,
  onClick,
}: {
  preview: React.ReactNode;
  name: string;
  description?: string;
  isSelected: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-xl border-2 overflow-hidden text-left transition-all duration-150 cursor-pointer",
        isSelected
          ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-1"
          : "border-[var(--border)] hover:border-[var(--primary)]/50"
      )}
    >
      <div
        className="relative w-full aspect-[4/3] text-[var(--foreground)] overflow-hidden"
        style={{ backgroundColor: "var(--muted)" }}
      >
        {preview}
        {badge && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[9px] font-bold z-10">
            <Sparkles size={7} /> {badge}
          </div>
        )}
        {isSelected && <div className="absolute inset-0 bg-[var(--primary)]/10" />}
      </div>
      <div className="p-2 bg-[var(--card)] flex-1">
        <p className={cn("text-xs font-semibold leading-tight mb-0.5", isSelected ? "text-[var(--primary)]" : "text-[var(--card-foreground)]")}>
          {name}
        </p>
        {description && (
          <p className="text-[9px] text-[var(--muted-foreground)] leading-snug line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Blank preview ────────────────────────────────────────────────────────────

function BlankPreview() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-1 opacity-20">
        <Plus size={18} />
        <div className="h-px w-8 bg-current" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PageTypePicker({ siteId, templates }: PageTypePickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [htmlContent, setHtmlContent] = useState("");
  const htmlFileRef = useRef<HTMLInputElement>(null);

  const allOfferTemplates = [
    ...(templates?.platform ?? []),
    ...(templates?.personal ?? []),
  ];

  function handleSelect(sel: Selection) {
    setSelection(sel);
    setError(null);
    if (sel.kind === "site-template") {
      setTitle(sel.template.name);
    } else if (sel.kind === "offer-template") {
      setTitle(sel.template.name);
    } else if (sel.kind === "custom") {
      setTitle("Custom Page");
    } else if (sel.kind === "html-import") {
      setTitle("Imported Page");
      setHtmlContent("");
    } else {
      setTitle("Offer Page");
    }
  }

  function isSelected(sel: Selection): boolean {
    if (!selection) return false;
    if (sel.kind !== selection.kind) return false;
    if (sel.kind === "site-template" && selection.kind === "site-template")
      return sel.template.key === selection.template.key;
    if (sel.kind === "offer-template" && selection.kind === "offer-template")
      return sel.template.id === selection.template.id;
    return true; // custom / offer-blank
  }

  function handleCreate() {
    if (!selection) return;
    setError(null);
    const resolvedTitle = title.trim() || "Untitled Page";

    if (selection.kind === "html-import") {
      if (!htmlContent.trim()) { setError("Please paste or upload HTML content."); return; }
      startTransition(async () => {
        const result = await createHtmlPage(siteId, resolvedTitle, htmlContent);
        if (result.error) { setError(result.error); return; }
        const extracted = extractStyleFromHtml(htmlContent);
        if (Object.keys(extracted).length > 0) {
          const base = THEMES_BY_KEY[DEFAULT_STYLE_KEY].tokens;
          const merged: StyleTokens = { ...base, ...extracted };
          await applyCustomStyle(siteId, merged);
        }
        setOpen(false);
        setSelection(null);
        setTitle("");
        setHtmlContent("");
        if (result.pageId) router.push(`/my-site/${siteId}/pages/${result.pageId}/edit`);
        else router.refresh();
      });
      return;
    }

    let pageType: string;
    let pageData: PageData | undefined;
    let theme: PageTheme | undefined;

    if (selection.kind === "site-template") {
      pageType = selection.template.pageType;
      pageData = selection.template.createPageData();
    } else if (selection.kind === "custom") {
      pageType = "custom";
      pageData = [];
    } else if (selection.kind === "offer-blank") {
      pageType = "offer";
      pageData = [];
    } else {
      pageType = "offer";
      pageData = selection.template.page_data;
      theme = selection.template.theme ?? undefined;
    }

    startTransition(async () => {
      const result = await addSitePage(siteId, resolvedTitle, pageType, pageData, theme);
      if (result.error) { setError(result.error); return; }
      setOpen(false);
      setSelection(null);
      setTitle("");
      if (result.pageId) {
        router.push(`/my-site/${siteId}/pages/${result.pageId}/edit`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelection(null); setTitle(""); setError(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus size={13} className="mr-1" /> Add Page</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col overflow-hidden p-0">
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <DialogHeader>
            <DialogTitle>Add a Page</DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

          {/* ── Home ── */}
          <div>
            <SectionHeader icon={<Home size={13} />} label="Home" />
            <div className="grid grid-cols-5 gap-2">
              {HOME_TEMPLATES.map((t) => {
                const sel: Selection = { kind: "site-template", template: t };
                return (
                  <TemplateCard
                    key={t.key}
                    preview={<LayoutPreview types={t.blockTypes} />}
                    name={t.name}
                    description={t.description}
                    isSelected={isSelected(sel)}
                    onClick={() => handleSelect(sel)}
                  />
                );
              })}
            </div>
          </div>

          {/* ── About ── */}
          <div>
            <SectionHeader icon={<User size={13} />} label="About" />
            <div className="grid grid-cols-5 gap-2">
              {ABOUT_TEMPLATES.map((t) => {
                const sel: Selection = { kind: "site-template", template: t };
                return (
                  <TemplateCard
                    key={t.key}
                    preview={<LayoutPreview types={t.blockTypes} />}
                    name={t.name}
                    description={t.description}
                    isSelected={isSelected(sel)}
                    onClick={() => handleSelect(sel)}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Work ── */}
          <div>
            <SectionHeader icon={<Grid3x3 size={13} />} label="Work & Portfolio" />
            <div className="grid grid-cols-5 gap-2">
              {WORK_TEMPLATES.map((t) => {
                const sel: Selection = { kind: "site-template", template: t };
                return (
                  <TemplateCard
                    key={t.key}
                    preview={<LayoutPreview types={t.blockTypes} />}
                    name={t.name}
                    description={t.description}
                    isSelected={isSelected(sel)}
                    onClick={() => handleSelect(sel)}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Contact ── */}
          <div>
            <SectionHeader icon={<Mail size={13} />} label="Contact" />
            <div className="grid grid-cols-5 gap-2">
              {CONTACT_TEMPLATES.map((t) => {
                const sel: Selection = { kind: "site-template", template: t };
                return (
                  <TemplateCard
                    key={t.key}
                    preview={<LayoutPreview types={t.blockTypes} />}
                    name={t.name}
                    description={t.description}
                    isSelected={isSelected(sel)}
                    onClick={() => handleSelect(sel)}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Custom ── */}
          <div>
            <SectionHeader icon={<FileText size={13} />} label="Custom" />
            <div className="grid grid-cols-5 gap-2">
              <TemplateCard
                preview={<BlankPreview />}
                name="Blank Page"
                description="Empty canvas — build anything"
                isSelected={isSelected({ kind: "custom" })}
                onClick={() => handleSelect({ kind: "custom" })}
              />
              <TemplateCard
                preview={
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1 opacity-30">
                      <Code2 size={18} />
                      <div className="h-px w-8 bg-current" />
                    </div>
                  </div>
                }
                name="Import HTML"
                description="Upload or paste a page built in Claude Code"
                isSelected={isSelected({ kind: "html-import" })}
                onClick={() => handleSelect({ kind: "html-import" })}
              />
            </div>
          </div>

          {/* ── HTML input (shown when html-import is selected) ── */}
          {selection?.kind === "html-import" && (
            <div className="space-y-3 rounded-xl border border-[var(--border)] p-4 bg-[var(--card)]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Paste or upload your HTML</p>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors">
                  <Upload size={12} /> Upload .html file
                  <input
                    ref={htmlFileRef}
                    type="file"
                    accept=".html,.htm"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setHtmlContent(ev.target?.result as string ?? "");
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="Paste your full HTML document here..."
                className="w-full h-36 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] font-mono text-[11px] p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 placeholder:text-[var(--muted-foreground)]"
                spellCheck={false}
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Colors and fonts will be extracted automatically and applied to this site.
              </p>
            </div>
          )}

          {/* ── Offer Pages ── */}
          <div>
            <SectionHeader icon={<ShoppingBag size={13} />} label="Offer Pages" />
            <div className="grid grid-cols-5 gap-2">
              {/* Blank offer */}
              <TemplateCard
                preview={<BlankPreview />}
                name="Blank"
                description="Empty offer page"
                isSelected={isSelected({ kind: "offer-blank" })}
                onClick={() => handleSelect({ kind: "offer-blank" })}
              />
              {/* DB templates */}
              {allOfferTemplates.map((t) => {
                const sel: Selection = { kind: "offer-template", template: t };
                const blockTypes = (t.page_data as PageData).map((b) => b.type);
                return (
                  <TemplateCard
                    key={t.id}
                    preview={<LayoutPreview types={blockTypes} />}
                    name={t.name}
                    description={t.description ?? undefined}
                    isSelected={isSelected(sel)}
                    badge={t.template_key === "platform_default" ? "Default" : undefined}
                    onClick={() => handleSelect(sel)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer: title + create ── */}
        {selection && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--border)] space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="page-title">Page title</Label>
                <Input
                  id="page-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Page title"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  autoFocus
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                  Create Page
                </Button>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
