"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Code2, Eye, MousePointerClick, ExternalLink, Wand2, Save, Loader2, Check, Globe, Settings, Link2, Unlink, ClipboardList, AlertCircle, Sparkles, Palette, X, Crosshair, Image as ImageIcon, Undo2, Redo2, Trash2, MousePointerSquareDashed, Type } from "lucide-react";
import Link from "next/link";
import { applyCustomStyle } from "@/lib/actions/html-pages";
import { togglePagePublished, saveSitePage } from "@/lib/actions/sites";
import { extractStyleFromHtml } from "@/lib/utils/extract-html-style";
import { HtmlVisualEditor, type HtmlVisualEditorHandle, type SelectionInfo, type FormInfo, type ImageSelectionInfo, type ElementSelectionInfo } from "@/components/site/HtmlVisualEditor";
import { injectFormCaptureScript } from "@/lib/utils/form-capture-script";
import { uploadImage } from "@/lib/utils/upload-image";
import { AiChatPanel } from "@/components/site/AiChatPanel";
import type { Tables } from "@/lib/db";
import type { StyleTokens } from "@/lib/styles/types";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY } from "@/lib/styles";
import { buildGoogleFontsUrl } from "@/lib/styles/utils";
import { FONT_OPTIONS, FONT_CATEGORIES, findFontOption } from "@/lib/utils/font-options";

type Page = Tables<"site_pages"> & { html_content?: string | null };

interface HtmlPageEditorProps {
  page: Page;
  siteId: string;
  siteSlug: string;
  customDomain?: string | null;
  aiEnabled?: boolean;
}

export function HtmlPageEditor({ page, siteId, siteSlug, customDomain = null, aiEnabled = false }: HtmlPageEditorProps) {
  const router = useRouter();
  const [html, setHtml] = useState(page.html_content ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState(false);
  // The updated_at this editor session last knew to be current — sent back
  // on save so the server can reject a write if the row moved since (e.g.
  // another tab, or a script) — see update-html/route.ts.
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState(page.updated_at);
  const [view, setView] = useState<"edit" | "preview" | "html">("edit");
  const [pageTitle, setPageTitle] = useState(page.title);
  const [pageSlug, setPageSlug] = useState(page.slug);
  const [isSavingSettings, startSaveSettings] = useTransition();
  const [settingsSaved, setSettingsSaved] = useState(false);
  const gateFields = page as unknown as {
    is_gated?: boolean | null;
    gate_title?: string | null;
    gate_description?: string | null;
    gate_button_text?: string | null;
  };
  const [isGated, setIsGated] = useState(gateFields.is_gated ?? false);
  const [gateTitle, setGateTitle] = useState(gateFields.gate_title ?? "");
  const [gateDescription, setGateDescription] = useState(gateFields.gate_description ?? "");
  const [gateButtonText, setGateButtonText] = useState(gateFields.gate_button_text ?? "");
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
  // Named selectedForDeletion (not selectedElement, which is already the
  // AI-picker's target state above) — an unrelated "click an element on the
  // canvas" mechanism that drives the Delete button instead of the AI panel.
  const [selectedForDeletion, setSelectedForDeletion] = useState<ElementSelectionInfo | null>(null);
  // Whether the *last click* landed inside a <form> — not sticky like the
  // selectors above (no selector to re-validate against), just re-resolved
  // fresh on every click. Drives whether the Forms panel shows at all.
  const [formAreaActive, setFormAreaActive] = useState(false);
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

  // Loads the full curated font list once in the *parent* document (not the
  // iframe) so the Font picker's own <option> elements can render each name
  // in its real typeface for a visual preview — separate from
  // ensureGoogleFontLoaded in HtmlVisualEditor.tsx, which only loads a font
  // into the edited page itself once it's actually applied.
  useEffect(() => {
    const id = "sage-font-picker-preview-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = buildGoogleFontsUrl(FONT_OPTIONS.map((f) => f.family));
    document.head.appendChild(link);
  }, []);

  // Resizing (drag, a preset button, or this very field) only ever commits
  // on blur/Enter, never per-keystroke, so there's no live typing state this
  // could clobber — safe to resync on every width change, which is what
  // keeps the field showing the real current width after a canvas drag
  // instead of a stale pre-drag number.
  useEffect(() => {
    setImageWidthInput(selectedImage ? String(selectedImage.widthPx) : "");
  }, [selectedImage?.selector, selectedImage?.widthPx]);

  function handleApplyLink() {
    if (!linkUrl.trim() || !selection?.hasSelection) return;
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

  function handleApplyFont(family: string) {
    if (!family) {
      editorRef.current?.clearFont();
      return;
    }
    const option = findFontOption(family);
    editorRef.current?.applyFont(family, option?.fallback ?? "sans-serif");
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

  function handleDeleteSelectedElement() {
    if (!selectedForDeletion) return;
    if (!confirm(`Delete ${selectedForDeletion.label}? You can still Undo afterward.`)) return;
    editorRef.current?.deleteSelectedElement();
    setSelectedForDeletion(null);
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
  // Memoized: this is passed to HtmlVisualEditor as `onChange`, which feeds
  // its own `emitChange` useCallback ([serialize, onChange]) — an unmemoized
  // function here gets a new identity every render, which made emitChange's
  // identity change every render too, and several self-revalidating effects
  // in HtmlVisualEditor (the image-selection one in particular) depend on
  // emitChange — so every render re-ran them, and the image effect calling
  // setSelectedImage() to report itself caused another render, cascading
  // into an infinite update loop the moment an image got selected. Only
  // depends on `html` (read for the pre-change snapshot pushed onto the undo
  // stack), so it stays stable across renders that don't change the content.
  const handleChange = useCallback((value: string) => {
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
  }, [html]);

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
    setSelectedForDeletion(null);
    setFormAreaActive(false);
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
    setSelectedForDeletion(null);
    setFormAreaActive(false);
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
    // Root-relative internal links (e.g. "/our-way") are written assuming the
    // page is nested in an iframe on its real custom domain (see
    // top-navigation-fix-script.ts). This blob preview opens the raw HTML as
    // its own top-level tab on the Studio app's own origin instead, so those
    // links would otherwise navigate the tab to e.g. sagestudio.org/our-way,
    // which doesn't exist. Rewrite clicks on such links to the correct target
    // — the live custom domain if one's verified, else the staging preview
    // route for this site — instead of letting the browser resolve them
    // against the blob's origin.
    const previewTarget = customDomain ? `https://${customDomain}` : `${window.location.origin}/sites/${siteSlug}`;
    const linkFixScript = `<script>(function(){
      var target = ${JSON.stringify(previewTarget)};
      document.addEventListener('click', function(e){
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '/') return;
        var t = link.getAttribute('target');
        if (t === '_blank' || t === '_top') return;
        e.preventDefault();
        var resolved = href === '/' ? target + '/' : (href.charAt(1) === '?' ? target + '/' + href.slice(1) : target + href);
        window.location.href = resolved;
      });
    })();</script>`;
    const previewHtml = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${linkFixScript}</body>`) : `${html}${linkFixScript}`;
    const blob = new Blob([previewHtml], { type: "text/html" });
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
    setSaveConflict(false);
    startSave(async () => {
      try {
        const res = await fetch("/api/site-pages/update-html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: page.id, htmlContent: html, expectedUpdatedAt: loadedUpdatedAt }),
        });
        const result = await res.json() as { ok?: boolean; error?: string; conflict?: boolean; updatedAt?: string };
        if (!res.ok || result.error) {
          setSaveError(result.error ?? "Save failed.");
          setSaveConflict(Boolean(result.conflict));
          return;
        }
        if (result.updatedAt) setLoadedUpdatedAt(result.updatedAt);
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
        is_gated: isGated,
        gate_title: gateTitle.trim() || null,
        gate_description: gateDescription.trim() || null,
        gate_button_text: gateButtonText.trim() || null,
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

          {aiEnabled && (
            <>
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
            </>
          )}

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
          {saveConflict && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-2 underline hover:opacity-80 flex-shrink-0"
            >
              Reload latest version
            </button>
          )}
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
                onClick={() => { setView("preview"); setSelection(null); setSelectedImage(null); setSelectedForDeletion(null); setFormAreaActive(false); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                  view === "preview"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Eye size={12} /> Preview
              </button>
              <button
                onClick={() => { setView("html"); setSelection(null); setSelectedImage(null); setSelectedForDeletion(null); setFormAreaActive(false); }}
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
              selectedElementSelector={selectedForDeletion?.selector ?? null}
              onElementSelected={setSelectedForDeletion}
              onFormAreaSelected={setFormAreaActive}
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

            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--foreground)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGated}
                  onChange={(e) => setIsGated(e.target.checked)}
                  className="rounded"
                />
                Require email to view this page
              </label>
              {isGated && (
                <div className="space-y-2 pl-0.5">
                  <input
                    type="text"
                    value={gateTitle}
                    onChange={(e) => setGateTitle(e.target.value)}
                    placeholder="Enter your email to continue"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
                  />
                  <textarea
                    value={gateDescription}
                    onChange={(e) => setGateDescription(e.target.value)}
                    placeholder="Optional description shown under the title"
                    rows={2}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 resize-none"
                  />
                  <input
                    type="text"
                    value={gateButtonText}
                    onChange={(e) => setGateButtonText(e.target.value)}
                    placeholder="Unlock"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
                  />
                </div>
              )}
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

          {view === "edit" && selection && selection.hasSelection && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <Link2 size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Link</p>
              </div>

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
            </div>
          )}

          {view === "edit" && selection && selection.hasSelection && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <Palette size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Text Color</p>
              </div>

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
            </div>
          )}

          {view === "edit" && selection && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <Type size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Font</p>
              </div>

              <div className="space-y-1.5">
                <select
                  value={findFontOption(selection.currentFont)?.family ?? ""}
                  onChange={(e) => handleApplyFont(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
                >
                  <option value="">Default</option>
                  {FONT_CATEGORIES.map((category) => (
                    <optgroup key={category} label={category}>
                      {FONT_OPTIONS.filter((f) => f.category === category).map((f) => (
                        <option key={f.family} value={f.family} style={{ fontFamily: `'${f.family}', ${f.fallback}` }}>
                          {f.family}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {selection.currentFont && !findFontOption(selection.currentFont) && (
                  <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                    Currently: <span style={{ fontFamily: `'${selection.currentFont}'` }}>{selection.currentFont}</span> (not in this list)
                  </p>
                )}
              </div>
            </div>
          )}

          {view === "edit" && selectedImage && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <ImageIcon size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Image</p>
              </div>

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

                  {selectedImage.siblingCount > 1 ? (
                    <p className="text-[11px] text-[var(--muted-foreground)] leading-snug bg-[var(--muted)]/40 rounded-lg px-2.5 py-2">
                      Part of a matching set of {selectedImage.siblingCount} images — resizing keeps them all uniform instead of distorting just this one.
                    </p>
                  ) : (
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
                  )}

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
            </div>
          )}

          {view === "edit" && selectedForDeletion && (
            <div className="p-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center gap-1.5">
                <MousePointerSquareDashed size={12} className="text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Selected Element</p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-mono text-[var(--muted-foreground)] leading-snug break-all bg-[var(--muted)]/40 rounded-lg px-2.5 py-2">
                  {selectedForDeletion.label}
                </p>
                <button
                  onClick={handleDeleteSelectedElement}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-500 text-xs hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          )}

          {view === "edit" && formAreaActive && forms.length > 0 && (
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

          {view === "edit" && !selection && !selectedImage && !selectedForDeletion && !(formAreaActive && forms.length > 0) && (
            <div className="p-4 border-b border-[var(--border)]">
              <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
                Click text, an image, or an element in the page to edit it here.
              </p>
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
