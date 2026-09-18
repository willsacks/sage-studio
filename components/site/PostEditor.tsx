"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { FocusPointPicker } from "@/components/ui/focus-point-picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { saveSitePost, togglePostPublished } from "@/lib/actions/site-posts";
import type { SitePost } from "@/lib/queries/site-posts";

/** A deliberately simple post editor for v1 — title/slug/excerpt/cover
 * image/meta fields plus a rich-text body field (with a raw-HTML toggle
 * built into RichTextEditor itself), reusing the same "paste your own
 * HTML" trust model already used and security-reviewed for site_pages'
 * html_content (see HtmlPageEditor.tsx) for whatever the editor produces.
 * It's also exactly the shape the WordPress importer needs to fill in (a
 * post's rendered HTML body), so this stays HTML-in/HTML-out under the hood. */
export function PostEditor({ siteId, siteUrl, blogSlug, post: initialPost }: { siteId: string; siteUrl: string; blogSlug: string; post: SitePost }) {
  const [post, setPost] = useState(initialPost);
  const [title, setTitle] = useState(initialPost.title);
  const [slug, setSlug] = useState(initialPost.slug);
  const [excerpt, setExcerpt] = useState(initialPost.excerpt ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialPost.cover_image_url);
  const [coverFocusX, setCoverFocusX] = useState(initialPost.cover_image_focus_x ?? 50);
  const [coverFocusY, setCoverFocusY] = useState(initialPost.cover_image_focus_y ?? 50);
  const [htmlContent, setHtmlContent] = useState(initialPost.html_content ?? "");
  const [metaTitle, setMetaTitle] = useState(initialPost.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(initialPost.meta_description ?? "");
  const [saved, setSaved] = useState(true);
  const [saving, startSaving] = useTransition();
  const [publishing, startPublishing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setSaved(false); };
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await saveSitePost(post.id, {
        title,
        slug,
        excerpt,
        coverImageUrl,
        coverImageFocusX: coverFocusX,
        coverImageFocusY: coverFocusY,
        htmlContent,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  function handleTogglePublish() {
    startPublishing(async () => {
      const result = await togglePostPublished(post.id, siteId, post.status !== "published");
      if (!result.error) {
        setPost((p) => ({ ...p, status: p.status === "published" ? "draft" : "published" }));
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/my-site/${siteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={14} /> Back to site
        </Link>
        <div className="flex items-center gap-2">
          {post.status === "published" && (
            <Link
              href={`${siteUrl}/${blogSlug}/${post.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
            >
              <ExternalLink size={13} /> View
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={handleTogglePublish} disabled={publishing}>
            {publishing ? <Loader2 size={13} className="animate-spin" /> : post.status === "published" ? <EyeOff size={13} /> : <Eye size={13} />}
            {post.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || saved}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Title</label>
          <Input value={title} onChange={(e) => markDirty(setTitle)(e.target.value)} className="text-lg font-semibold h-auto py-2" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Slug</label>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-[var(--muted-foreground)] font-mono">/{blogSlug}/</span>
            <Input value={slug} onChange={(e) => markDirty(setSlug)(e.target.value)} className="font-mono text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => markDirty(setExcerpt)(e.target.value)}
            placeholder="A short summary shown on the blog archive"
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Cover image</label>
          <ImageUploader value={coverImageUrl} onChange={markDirty(setCoverImageUrl)} bucket="offering-media" folder="site-posts" aspectRatio="wide" />
          {coverImageUrl && (
            <FocusPointPicker
              imageUrl={coverImageUrl}
              focusX={coverFocusX}
              focusY={coverFocusY}
              onChange={(x, y) => { markDirty(setCoverFocusX)(x); markDirty(setCoverFocusY)(y); }}
              aspectRatio="wide"
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Body</label>
        <RichTextEditor
          content={htmlContent}
          onChange={markDirty(setHtmlContent)}
          placeholder="Write or paste your post content here..."
        />
      </div>

      <details className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <summary className="text-xs font-medium text-[var(--muted-foreground)] cursor-pointer">SEO (optional)</summary>
        <div className="space-y-3 mt-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Meta title</label>
            <Input value={metaTitle} onChange={(e) => markDirty(setMetaTitle)(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Meta description</label>
            <textarea
              value={metaDescription}
              onChange={(e) => markDirty(setMetaDescription)(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
