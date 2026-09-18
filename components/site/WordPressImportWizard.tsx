"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PreviewItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
}

interface Preview {
  siteName: string | null;
  pages: PreviewItem[];
  posts: PreviewItem[];
}

interface ImportResult {
  pagesImported: number;
  postsImported: number;
  warnings: string[];
}

type Step = "url" | "preview" | "importing" | "done";

/** Multi-step wizard mirroring WaveImportWizard.tsx's shape (connect →
 * preview → import → done), but pulling from a public WordPress site's REST
 * API instead of an uploaded file — no export step required on the user's
 * end. Imported pages/posts land as drafts for review before publishing. */
export function WordPressImportWizard({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("url");
  const [siteUrl, setSiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setStep("url");
    setSiteUrl("");
    setError(null);
    setPreview(null);
    setSelectedPages(new Set());
    setSelectedPosts(new Set());
    setResult(null);
  }

  function handleClose(v: boolean) {
    setOpen(v);
    if (!v) reset();
  }

  async function handleFetchPreview() {
    if (!siteUrl.trim()) { setError("Please enter your WordPress site's URL."); return; }
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/site-pages/import-wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", siteUrl }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Could not reach that site."); return; }
      setPreview(data);
      setSelectedPages(new Set(data.pages.map((p: PreviewItem) => p.id)));
      setSelectedPosts(new Set(data.posts.map((p: PreviewItem) => p.id)));
      setStep("preview");
    } catch {
      setError("Could not reach that site — check the URL and try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleImport() {
    setStep("importing");
    setError(null);
    try {
      const res = await fetch("/api/site-pages/import-wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          siteId,
          siteUrl,
          selection: { pageIds: [...selectedPages], postIds: [...selectedPosts] },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Import failed.");
        setStep("preview");
        return;
      }
      setResult(data);
      setStep("done");
      router.refresh();
    } catch {
      setError("Import failed — check your connection and try again.");
      setStep("preview");
    }
  }

  function toggle(set: Set<number>, setSet: (s: Set<number>) => void, id: number) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  const totalSelected = selectedPages.size + selectedPosts.size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors">
          <Globe2 size={13} /> Import from WordPress
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from WordPress</DialogTitle>
          <DialogDescription>
            Pulls your published pages and posts straight from your site's public API — no export file needed.
          </DialogDescription>
        </DialogHeader>

        {step === "url" && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="wp-url">Your WordPress site's URL</Label>
              <Input
                id="wp-url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="fulcrumventures.io"
                onKeyDown={(e) => e.key === "Enter" && handleFetchPreview()}
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={handleFetchPreview} disabled={isPending || !siteUrl.trim()}>
                {isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
                Find content
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Found {preview.pages.length} page{preview.pages.length === 1 ? "" : "s"} and {preview.posts.length} post{preview.posts.length === 1 ? "" : "s"}
              {preview.siteName ? ` on ${preview.siteName}` : ""}. Everything imports as a draft so you can review before publishing.
            </p>

            {preview.pages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">Pages</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                  {preview.pages.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--accent)]">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedPages.has(p.id)}
                        onChange={() => toggle(selectedPages, setSelectedPages, p.id)}
                      />
                      <span>{p.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {preview.posts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">Posts</p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                  {preview.posts.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--accent)]">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedPosts.has(p.id)}
                        onChange={() => toggle(selectedPosts, setSelectedPosts, p.id)}
                      />
                      <span>{p.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {preview.pages.length === 0 && preview.posts.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">No published pages or posts found on that site.</p>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("url")}>Back</Button>
              <Button onClick={handleImport} disabled={totalSelected === 0}>
                <Download size={13} className="mr-1.5" /> Import {totalSelected} item{totalSelected === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Importing content and re-hosting images — this can take a minute...</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-3">
            <p className="text-sm text-green-600">
              Imported {result.pagesImported} page{result.pagesImported === 1 ? "" : "s"} and {result.postsImported} post{result.postsImported === 1 ? "" : "s"} as drafts.
            </p>
            {result.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">A few things needed attention:</p>
                <ul className="text-xs text-[var(--muted-foreground)] list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <Button size="sm" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
