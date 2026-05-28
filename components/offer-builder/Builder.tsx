"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Save, Eye, Globe, Bookmark, Layers, Loader2, Check, AlertCircle, Monitor, Tablet, Smartphone, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useBuilderStore, type SitePageRef } from "@/lib/store/builder";
import { saveOfferPage, publishOfferPage } from "@/lib/actions/offer-pages";
import type { OfferPage } from "@/lib/queries/offer-pages";
import type { OfferTemplate } from "@/lib/queries/offer-templates";
import type { PageData, PageTheme } from "@/lib/types/builder";
import { BlockLibrary } from "./BlockLibrary";
import { Canvas } from "./Canvas";
import { BlockSettings } from "./BlockSettings";
import { TemplateSelector } from "./TemplateSelector";
import { PublishSettingsModal } from "./PublishSettingsModal";
import { SaveAsTemplateModal } from "./SaveAsTemplateModal";
import { cn } from "@/lib/utils/cn";

interface BuilderProps {
  page: OfferPage;
  artistUsername: string | null;
  isAdmin: boolean;
  templates: {
    platform: OfferTemplate[];
    personal: OfferTemplate[];
    promoted: OfferTemplate[];
  };
  // Optional overrides for site page builder
  saveAction?: (id: string, data: { title: string; page_data: PageData; theme?: PageTheme }) => Promise<{ error?: string } | undefined>;
  publishAction?: (id: string, published: boolean) => Promise<void>;
  saveSettingsAction?: (id: string, data: { slug: string; publish_mode: string; custom_domain?: string; og_image?: string | null; og_title?: string | null; og_description?: string | null }) => Promise<void>;
  siteContext?: { siteSlug: string; pages: SitePageRef[] };
  siteStyleVars?: string;
  ornamentStyleVars?: string;
  previewUrlOverride?: string | null;
  backUrl?: string;
}

type Modal = "template" | "publish" | "save-template" | null;
export type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_BUTTONS: { id: Viewport; icon: typeof Monitor; label: string }[] = [
  { id: "desktop", icon: Monitor, label: "Desktop" },
  { id: "tablet", icon: Tablet, label: "Tablet" },
  { id: "mobile", icon: Smartphone, label: "Mobile" },
];

export function Builder({ page, artistUsername, isAdmin, templates, saveAction, publishAction, saveSettingsAction, siteContext, siteStyleVars, ornamentStyleVars, previewUrlOverride, backUrl }: BuilderProps) {
  const { reset, blocks, theme, isDirty, markSaved, selectedBlockId, setSiteContext } = useBuilderStore();

  const [modal, setModal] = useState<Modal>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [status, setStatus] = useState<"draft" | "published">(page.status as "draft" | "published");

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialize store from page data
  useEffect(() => {
    setSiteContext(siteContext ?? null);
    const initialTheme = (page.theme as PageTheme | null) ?? undefined;
    const rawPageData = page.page_data as PageData | null;
    const initialBlocks = rawPageData ?? [];
    // Only show template selector when page_data was never set (null) — not when it's an explicit empty array
    if (rawPageData === null) {
      const platformDefault = templates.platform.find((t) => t.template_key === "platform_default");
      if (platformDefault) {
        reset(platformDefault.page_data, (platformDefault.theme as PageTheme) ?? undefined);
      } else {
        reset([], initialTheme);
      }
      setModal("template");
    } else {
      reset(initialBlocks, initialTheme);
    }
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSave = useCallback(async () => {
    setSaving(true);
    const result = saveAction
      ? await saveAction(page.id, { title, page_data: blocks, theme })
      : await saveOfferPage(page.id, { title, page_data: blocks, theme });
    setSaving(false);
    if (result?.error) {
      setSaveStatus("error");
    } else {
      markSaved();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, [page.id, title, blocks, theme, markSaved, saveAction]);

  // Auto-save every 30s when dirty
  useEffect(() => {
    if (!isDirty) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(doSave, 30_000);
    return () => clearTimeout(autoSaveRef.current);
  }, [isDirty, doSave]);

  // Warn on nav when dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  async function handleTogglePublish() {
    const next = status === "published" ? "draft" : "published";
    setStatus(next);
    if (publishAction) {
      await publishAction(page.id, next === "published");
    } else {
      await publishOfferPage(page.id, next === "published");
    }
  }

  const previewUrl = previewUrlOverride !== undefined
    ? previewUrlOverride
    : artistUsername
    ? `/artists/${artistUsername}/${page.slug}?preview=1`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Top Bar */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)] bg-[var(--card)] flex-shrink-0">
        {/* Back link */}
        {backUrl && (
          <Link
            href={backUrl}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
            title="Back"
          >
            <ArrowLeft size={16} />
          </Link>
        )}
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[var(--foreground)] focus:outline-none border-b border-transparent focus:border-[var(--primary)] pb-0.5 truncate"
          maxLength={120}
        />

        {/* Viewport toggle — centered */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[var(--background)] rounded-lg p-1 border border-[var(--border)]">
          {VIEWPORT_BUTTONS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setViewport(id)}
              title={label}
              className={cn(
                "flex items-center justify-center w-8 h-7 rounded transition-colors",
                viewport === id
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Change Template */}
          <button
            onClick={() => setModal("template")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <Layers size={14} /> Template
          </button>

          {/* Save as Template */}
          <button
            onClick={() => setModal("save-template")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <Bookmark size={14} /> Save as Template
          </button>

          {/* Preview */}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              <Eye size={14} /> Preview
            </a>
          )}

          {/* Publish Settings */}
          <button
            onClick={() => setModal("publish")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            <Globe size={14} /> Settings
          </button>

          {/* Status toggle */}
          <button
            onClick={handleTogglePublish}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium transition-colors",
              status === "published"
                ? "bg-green-600/20 text-green-400 border border-green-600/40 hover:bg-green-600/30"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            )}
          >
            {status === "published" ? "Published" : "Draft"}
          </button>

          {/* Save */}
          <button
            onClick={doSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold transition-colors",
              saveStatus === "saved"
                ? "bg-green-600 text-white"
                : saveStatus === "error"
                ? "bg-red-600 text-white"
                : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
              saving && "opacity-70 cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> :
             saveStatus === "saved" ? <Check size={13} /> :
             saveStatus === "error" ? <AlertCircle size={13} /> :
             <Save size={13} />}
            {saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Error" : "Save"}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <BlockLibrary selectedBlockId={selectedBlockId} />
        <main className="flex-1 overflow-hidden" data-builder-canvas>
          {(siteStyleVars || ornamentStyleVars) && (
            <style>{`[data-builder-canvas] { ${siteStyleVars ?? ""} ${ornamentStyleVars ?? ""} }`}</style>
          )}
          <Canvas viewport={viewport} />
        </main>
        <BlockSettings />
      </div>

      {/* Modals */}
      {modal === "template" && (
        <TemplateSelector templates={templates} onClose={() => setModal(null)} />
      )}
      {modal === "publish" && (
        <PublishSettingsModal
          page={{ ...page, slug }}
          artistUsername={artistUsername}
          onClose={() => setModal(null)}
          onSlugChange={setSlug}
          saveSettingsAction={saveSettingsAction}
        />
      )}
      {modal === "save-template" && (
        <SaveAsTemplateModal pageId={page.id} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
