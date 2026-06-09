"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Code2, Eye, ExternalLink, Wand2, Save, Loader2, Check, Globe, Settings } from "lucide-react";
import Link from "next/link";
import { updateHtmlPage, applyCustomStyle } from "@/lib/actions/html-pages";
import { togglePagePublished, saveSitePage } from "@/lib/actions/sites";
import { extractStyleFromHtml } from "@/lib/utils/extract-html-style";
import type { Tables } from "@/lib/db";
import type { StyleTokens } from "@/lib/styles/types";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY } from "@/lib/styles";

type Page = Tables<"site_pages"> & { html_content?: string | null };

interface HtmlPageEditorProps {
  page: Page;
  siteId: string;
  siteSlug: string;
}

export function HtmlPageEditor({ page, siteId, siteSlug }: HtmlPageEditorProps) {
  const router = useRouter();
  const [html, setHtml] = useState(page.html_content ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<"preview" | "html">("preview");
  const [pageTitle, setPageTitle] = useState(page.title);
  const [pageSlug, setPageSlug] = useState(page.slug);
  const [isSavingSettings, startSaveSettings] = useTransition();
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [extractedTokens, setExtractedTokens] = useState<Partial<StyleTokens> | null>(null);
  const [isApplying, startApply] = useTransition();
  const [styleApplied, setStyleApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isPublished = page.status === "published";

  function handleChange(value: string) {
    setHtml(value);
    setIsDirty(true);
    setSaved(false);
    setExtractedTokens(null);
    setStyleApplied(false);
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
    startSave(async () => {
      await updateHtmlPage(page.id, html);
      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Editor / Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toggle bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] flex-shrink-0">
            <div className="flex items-center gap-0.5 bg-[var(--muted)] rounded-lg p-0.5">
              <button
                onClick={() => setView("preview")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                  view === "preview"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Eye size={12} /> Preview
              </button>
              <button
                onClick={() => setView("html")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                  view === "html"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Code2 size={12} /> HTML
              </button>
            </div>

            {view === "html" && (
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

          {/* Content */}
          {view === "preview" ? (
            <iframe
              srcDoc={html}
              className="flex-1 w-full border-none"
              sandbox="allow-scripts allow-same-origin"
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
