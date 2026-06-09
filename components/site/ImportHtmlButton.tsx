"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Code2, Upload, Loader2 } from "lucide-react";
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
import { createHtmlPage, applyCustomStyle } from "@/lib/actions/html-pages";
import { extractStyleFromHtml } from "@/lib/utils/extract-html-style";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY } from "@/lib/styles";
import type { StyleTokens } from "@/lib/styles/types";

interface ImportHtmlButtonProps {
  siteId: string;
}

export function ImportHtmlButton({ siteId }: ImportHtmlButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Imported Page");
  const [htmlContent, setHtmlContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setHtmlContent(ev.target?.result as string ?? "");
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleClose(v: boolean) {
    setOpen(v);
    if (!v) {
      setTitle("Imported Page");
      setHtmlContent("");
      setError(null);
    }
  }

  function handleImport() {
    if (!htmlContent.trim()) { setError("Please paste or upload HTML content."); return; }
    setError(null);
    const resolvedTitle = title.trim() || "Imported Page";

    startTransition(async () => {
      const result = await createHtmlPage(siteId, resolvedTitle, htmlContent);
      if (result.error) { setError(result.error); return; }

      // Silently extract and apply style if CSS variables are found
      const extracted = extractStyleFromHtml(htmlContent);
      if (Object.keys(extracted).length > 0) {
        const base = THEMES_BY_KEY[DEFAULT_STYLE_KEY].tokens;
        const merged: StyleTokens = { ...base, ...extracted };
        await applyCustomStyle(siteId, merged);
      }

      setOpen(false);
      if (result.pageId) router.push(`/my-site/${siteId}/pages/${result.pageId}/edit`);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors">
          <Code2 size={13} /> Import HTML
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import HTML Page</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="import-title">Page title</Label>
            <Input
              id="import-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>HTML content</Label>
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
            </div>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="Paste your full HTML document here..."
              className="w-full h-48 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] font-mono text-[11px] leading-relaxed p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 placeholder:text-[var(--muted-foreground)]"
              spellCheck={false}
            />
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            Colors and fonts will be extracted from your HTML and applied to this site automatically. The page will be saved as a draft.
          </p>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={isPending || !htmlContent.trim()}>
              {isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Import Page
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
