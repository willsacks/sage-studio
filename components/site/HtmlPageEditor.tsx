"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Code2, Eye, MousePointerClick, ExternalLink, Wand2, Save, Loader2, Check, Globe, Settings, Link2, Unlink, ClipboardList, AlertCircle, Sparkles, Palette, X, Crosshair, Image as ImageIcon, Undo2, Redo2 } from "lucide-react";
import Link from "next/link";
import { applyCustomStyle } from "@/lib/actions/html-pages";
import { togglePagePublished, saveSitePage } from "@/lib/actions/sites";
import { extractStyleFromHtml } from "@/lib/utils/extract-html-style";
import { HtmlVisualEditor, type HtmlVisualEditorHandle, type SelectionInfo, type FormInfo, type ImageSelectionInfo } from "@/components/site/HtmlVisualEditor";
import { injectFormCaptureScript } from "@/lib/utils/form-capture-script";
import { uploadImage } from "@/lib/utils/upload-image";
import { AiChatPanel } from "@/components/site/AiChatPanel";
import type { Tables } from "@/lib/db";
import type { StyleTokens } from "@/lib/styles/types";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY } from "@/lib/styles";

type Page = Tables<"site_pages"> & { html_content?: string | null };

interface HtmlPageEditorProps {
  page: Page;
  siteId: string;
  siteSlug: string;
  aiEnabled?: boolean;
}

export function HtmlPageEditor({ page, siteId, siteSlug, aiEnabled = false }: HtmlPageEditorProps) {
  const router = useRouter();
  const [html, setHtml] = useState(page.html_content ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview" | "html">("edit");
  const [pageTitle, setPageTitle] = useState(page.title);
  const [pageSlug, setPageSlug] = useState(page.slug);
  const [isSavingSettings, startSaveSettings] = useTransition();
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [extractedTokens, setExtractedTokens] = useState<Partial<StyleTokens> | null>(null);
  const [isApplying, startApply] = useTransition();
  const [styleApplied, setStyleApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HtmlVisualEditorHandle>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [textColor, setTextColor] = useState("#000000");
  const [forms, setForms] = useState<FormInfo[]>([]);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ selector: string; label: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageSelectionInfo | null>(null);
  const [imageWidthInput, setImageWidthInput] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const lastHistoryPushRef = useRef(0);

  const isPublished = page.status === "published";

  useEffect(() => {
    setLinkUrl(selection?.href ?? "");
  }, [selection]);

  // Resizing (drag, a preset button, or this very field) only ever commits
  // on blur/Enter, never per-keystroke, so there's no live typing state this
  // could clobber — safe to resync on every width change, which is what
  // keeps the field showing the real current width after a canvas drag
  // instead of a stale pre-drag number.
  useEffect(() => {
    setImageWidthInput(selectedImage ? String(selectedImage.widthPx) : "");
  }, [selectedImage?.selector, selectedImage?.widthPx]);

  function handleApplyLink() {
    if (!linkUrl.trim()) return;
    editorRef.current?.applyLink(linkUrl.trim());
  }

  function handleRemoveLink() {
    editorRef.current?.removeLink();
    setLinkUrl("");
  }

  function handleApplyColor(color: string) {
    setTextColor(color);
    editorRef.current?.applyColor(color);
  }

  function handleClearColor() {
    editorRef.current?.clearColor();
  }

  function handleToggleForm(formId: string, connected: boolean) {
    editorRef.current?.toggleForm(formId, connected);
  }

  function handleElementPicked(info: { selector: string; label: string } | null) {
    setSelectedElement(info);
    if (info) setPickerMode(false); // picked something — done pointing, now type in the AI panel
  }

  function handleTogglePickerMode() {
    setPickerMode((prev) => {
      const next = !prev;
      if (next) {
        setView("edit"); // picking only works in the Edit view
        setAiPanelOpen(true);
      }
      return next;
    });
  }

  function handleApplyImageWidth() {
    const px = parseInt(imageWidthInput, 10);
    if (!Number.isFinite(px) || px <= 0) return;
    editorRef.current?.resizeSelectedImage(px);
  }

  async function handleReplaceImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageUploadError(null);
    setIsUploadingImage(true);
    try {
      const url = await uploadImage(file, "offering-media", "html-editor");
      editorRef.current?.replaceSelectedImageSrc(url);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  const HISTORY_LIMIT = 50;
  // Every mutation source in this editor (typing, drag-reorder, link/color,
  // image resize/replace, a raw-HTML paste, a re-uploaded file, and AI edits)
  // already funnels through this one function via onChange/onHtmlUpdate, so
  // hooking undo here covers all of them uniformly with no per-source
  // wiring. Pushes are time-coalesced (skipped if the last push was under a
  // second ago) so a burst of rapid changes — several AI tool calls in one
  // turn, or the debounced-but-still-frequent updates while typing — collapse
  // into a single undo step instead of one step per intermediate change.
  function handleChange(value: string) {
    const now = Date.now();
    if (now - lastHistoryPushRef.current > 1000) {
      setHistory((prev) => {
        const next = [...prev, html];
        return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
      });
      setFuture([]);
    }
    lastHistoryPushRef.current = now;
    setHtml(value);
    setIsDirty(true);
    setSaved(false);
    setExtractedTokens(null);
    setStyleApplied(false);
  }

  function handleUndo() {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [html, ...prev]);
    setHtml(previous);
    setIsDirty(true);
    setSaved(false);
    setSelection(null);
    setSelectedImage(null);
    lastHistoryPushRef.current = 0; // next edit always starts a fresh step, never coalesces into the undone one
  }

  function handleRedo() {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, html]);
    setHtml(next);
    setIsDirty(true);
    setSaved(false);
    setSelection(null);
    setSelectedImage(null);
    lastHistoryPushRef.current = 0;
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      handleChange(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handlePreview() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function handleExtract() {
    const tokens = extractStyleFromHtml(html);
    setExtractedTokens(Object.keys(tokens).length > 0 ? tokens : {});
  }

  function handleApplyStyle() {
    if (!extractedTokens) return;
    const baseTokens = THEMES_BY_KEY[DEFAULT_STYLE_KEY].tokens;
    const merged: StyleTokens = { ...baseTokens, ...extractedTokens };
    startApply(async () => {
      await applyCustomStyle(siteId, merged);
      setStyleApplied(true);
      router.refresh();
    });
  }

  function handleSave() {
    setSaveError(null);
    startSave(async () => {
      try {
        const res = await fetch("/api/site-pages/update-html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: page.id, htmlContent: html }),
        });
        const result = await res.json() as { ok?: boolean; error?: string };
        if (!res.ok || result.error) {
          setSaveError(result.error ?? "Save failed.");
          return;
        }
        setIsDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        setSaveError("Save failed — this page may be too large. Contact support if this keeps happening.");
      }
    });
  }

  function handleTogglePublish() {
    startPublish(async () => {
      await togglePagePublished(page.id, siteId, !isPublished);
      router.refresh();
    });
  }

  function handleSaveSettings() {
    const slug = pageSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    startSaveSettings(async () => {
      await saveSitePage(page.id, {
        title: pageTitle.trim() || page.title,
        slug: slug || page.slug,
        siteId,
      });
      setPageSlug(slug || page.slug);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
      router.refresh();
    });
  }

  const extractedColorKeys = extractedTokens
    ? (["colorBackground", "colorText", "colorAccent", "colorBorder"] as const).filter(
        (k) => extractedTokens[k]
      )
    : [];

  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/my-site/${siteId}`}
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="text-[var(--border)]">/</span>
          <span className="text-sm font-medium truncate max-w-[200px]">{pageTitle}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] font-medium">
            HTML Page
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 mr-1">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Redo"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <Redo2 size={14} />
            </button>
          </div>

          <button
            onClick={() => setAiPanelOpen((o) => !o)}
            title="AI Assistant"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              aiPanelOpen
                ? "border-[var(--primary)]/50 bg-[var(--primary)]/10 text-[var(--primary)]"
                : "border-[var(--border)] hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
            }`}
          >
            <Sparkles size={13} /> AI
          </button>

          <button
            onClick={handleTogglePickerMode}
            title="Click an element on the page to direct the AI to it"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              pickerMode
                ? "border-green-600/50 bg-green-600/10 text-green-600"
                : "border-[var(--border)] hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
            }`}
          >
            <Crosshair size={13} /> {pickerMode ? "Click an element…" : "Select for AI"}
          </button>

          <button
            onClick={handlePreview}
            title="Open in new tab"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
          >
            <ExternalLink size={13} />
          </button>

          <button
            onClick={handleTogglePublish}
            disabled={isPublishing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              isPublished
                ? "border-[var(--border)] hover:bg-[var(--accent)]"
                : "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
            }`}
          >
            {isPublishing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Globe size={12} />
            )}
            {isPublished ? "Published" : "Publish"}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <Check size={12} />
            ) : (
              <Save size={12} />
            )}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-red-600 bg-red-500/10 border-b border-red-500/30 flex-shrink-0">
          <AlertCircle size={13} className="flex-shrink-0" /> {saveError}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* AI Panel */}
        {aiPanelOpen && (
          <div className="w-80 flex-shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">
            <AiChatPanel
              editorType="html"
              aiEnabled={aiEnabled}
              pageId={page.id}
              pageTitle={pageTitle}
              html={html}
              onHtmlUpdate={handleChange}
              selectedContext={selectedElement ? { label: selectedElement.label, key: selectedElement.selector } : null}
              onClearSelection={() => setSelectedElement(null)}
            />
          </div>
        )}

        {/* Editor / Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toggle bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] flex-shrink-0">
            <div className="flex items-center gap-0.5 bg-[var(--muted)] rounded-lg p-0.5">
              <button
                onClick={() => setView("edit")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                  view === "edit"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <MousePointerClick size={12} /> Edit
              </button>
              <button
                onClick={() => { setView("preview"); setSelection(null); setSelectedImage(null); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                  view === "preview"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Eye size={12} /> Preview
              </button>
              <button
                onClick={() => { setView("html"); setSelection(null); setSelectedImage(null); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                  view === "html"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Code2 size={12} /> HTML
              </button>
            </div>

            {view !== "preview" && (
              <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors">
                <Upload size={12} /> Upload .html file
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.htm"
                  className="sr-only"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>

          {view === "edit" && (
            <div className="px-4 py-1.5 text-[11px] text-[var(--muted-foreground)] bg-[var(--card)] border-b border-[var(--border)] flex-shrink-0">
              Click any text to edit it in place, or select text to add a link in the sidebar. Click an image to resize (drag its corners) or replace it. Hover a section to reveal its <span className="font-mono">⠿</span> handle, then drag to reorder.
            </div>
          )}

          {/* Content */}
          {view === "edit" ? (
            <HtmlVisualEditor
              ref={editorRef}
              html={html}
              onChange={handleChange}
              onSelectionInfo={setSelection}
              onFormsDetected={setForms}
              pickerMode={pickerMode}
              selectedSelector={selectedElement?.selector ?? null}
              onElementPicked={handleElementPicked}
              selectedImageSelector={selectedImage?.selector ?? null}
              onImageSelected={setSelectedImage}
            />
          ) : view === "preview" ? (
            <iframe
              srcDoc={injectFormCaptureScript(html, siteSlug)}
              className="flex-1 w-full border-none"
              // No allow-same-origin: this preview renders arbitrary saved HTML
              // (editor-role collaborators can write it) inside the authenticated
              // dashboard. allow-scripts + allow-same-origin together would let
              // injected script reach window.parent as same-origin and hijack the
              // viewing user's session — keeping the origin opaque prevents that.
              sandbox="allow-scripts"
              title={`Preview: ${page.title}`}
            />
          ) : (
            <textarea
              value={html}
              onChange={(e) => handleChange(e.target.value)}
              className="flex-1 w-full resize-none bg-[var(--background)] font-mono text-xs leading-relaxed p-4 focus:outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              placeholder="Paste your HTML here, or upload a .html file above..."
              spellCheck={false}
            />
          )}
        </div>

        {/* Settings + Style panel */}
        <div className="w-64 flex-shrink-0 border-l border-[var(--border)] flex flex-col bg-[var(--card)] overflow-y-auto">
          {/* Page settings */}
          <div className="p-4 border-b border-[var(--border)] space-y-3">
            <div className="flex items-center gap-1.5">
              <Settings size={12} className="text-[var(--muted-foreground)]" />
              <p className="text-xs font-semibold text-[var(--foreground)]">Page Settings</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Title
              </label>
              <input
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                URL slug
              </label>
              <input
                type="text"
                value={pageSlug}
                onChange={(e) => setPageSlug(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] font-mono text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
              />
              <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                sagestudio.org/sites/{siteSlug}/{pageSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "..."}
              </p>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
            >
              {isSavingSettings ? (
                <Loader2 size={12} className="animate-spin" />
              ) : settingsSaved ? (
                <Check size={12} />
              ) : (
                <Save size={12} />
              )}
              {settingsSaved ? "Saved" : "Save Settings"}
            </button>
          </div>

          {view === "edit" && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <Link2 size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Link</p>
              </div>

              {selection ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
                    onKeyDown={(e) => { if (e.key === "Enter") handleApplyLink(); }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleApplyLink}
                      disabled={!linkUrl.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <Link2 size={12} /> {selection.href ? "Update" : "Add Link"}
                    </button>
                    {selection.href && (
                      <button
                        onClick={handleRemoveLink}
                        title="Remove link"
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Unlink size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
                  Select some text in the page to add a link.
                </p>
              )}
            </div>
          )}

          {view === "edit" && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <Palette size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Text Color</p>
              </div>

              {selection ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => handleApplyColor(e.target.value)}
                    title="Pick a color"
                    className="w-8 h-8 rounded-lg border border-[var(--border)] p-0.5 cursor-pointer bg-transparent"
                  />
                  <button
                    onClick={handleClearColor}
                    title="Clear color (reset to default)"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
                  >
                    <X size={12} /> Clear
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
                  Select some text, then pick a color to apply it.
                </p>
              )}
            </div>
          )}

          {view === "edit" && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <ImageIcon size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Image</p>
              </div>

              {selectedImage ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]/30 aspect-video flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedImage.src} alt="" className="max-w-full max-h-full object-contain" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      min={40}
                      value={imageWidthInput}
                      onChange={(e) => setImageWidthInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleApplyImageWidth(); }}
                      onBlur={handleApplyImageWidth}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
                    />
                  </div>

                  <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-[11px] font-medium">
                    {([["Small", 200], ["Medium", 400], ["Large", 800]] as const).map(([label, px]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => editorRef.current?.resizeSelectedImage(px)}
                        className="flex-1 py-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors border-r border-[var(--border)]"
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => editorRef.current?.resizeSelectedImage("full")}
                      className="flex-1 py-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
                    >
                      Full
                    </button>
                  </div>

                  <label className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors cursor-pointer">
                    {isUploadingImage ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {isUploadingImage ? "Uploading…" : "Replace Image"}
                    <input
                      ref={imageFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={handleReplaceImageFile}
                      disabled={isUploadingImage}
                    />
                  </label>
                  {imageUploadError && <p className="text-[11px] text-red-500">{imageUploadError}</p>}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
                  Click an image in the page to resize or replace it.
                </p>
              )}
            </div>
          )}

          {view === "edit" && forms.length > 0 && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <ClipboardList size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Forms</p>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
                Connect a form to see its submissions in Sage Studio. Forms left off keep working as imported.
              </p>
              <div className="space-y-1.5">
                {forms.map((form) => (
                  <button
                    key={form.id}
                    onClick={() => handleToggleForm(form.id, !form.connected)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                      form.connected
                        ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--foreground)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    <span className="truncate">{form.label}</span>
                    <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      form.connected
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}>
                      {form.connected ? "Connected" : "Off"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--foreground)] mb-1">Site Style</p>
            <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
              Extract colors and fonts from your HTML and apply them to this site.
            </p>
          </div>

          <div className="p-4 space-y-3 flex-1">
            <button
              onClick={handleExtract}
              disabled={!html.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors disabled:opacity-40"
            >
              <Wand2 size={13} /> Extract Style from HTML
            </button>

            {extractedTokens !== null && (
              <div className="space-y-2">
                {extractedColorKeys.length > 0 ? (
                  <>
                    <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Extracted Colors
                    </p>
                    <div className="space-y-1.5">
                      {extractedColorKeys.map((key) => (
                        <div key={key} className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded border border-[var(--border)] flex-shrink-0"
                            style={{ backgroundColor: extractedTokens[key] as string }}
                          />
                          <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                            {extractedTokens[key] as string}
                          </span>
                        </div>
                      ))}
                    </div>
                    {extractedTokens.fontDisplay && (
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Font: <span className="font-medium text-[var(--foreground)]">{extractedTokens.fontDisplay}</span>
                      </p>
                    )}
                    <button
                      onClick={handleApplyStyle}
                      disabled={isApplying || styleApplied}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isApplying ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : styleApplied ? (
                        <Check size={12} />
                      ) : (
                        <Wand2 size={12} />
                      )}
                      {styleApplied ? "Applied!" : "Apply to Site"}
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    No CSS variables found. Try a page with a <code className="text-[10px]">:root {"{}"}</code> block.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
