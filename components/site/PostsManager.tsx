"use client";

import { useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { togglePostPublished } from "@/lib/actions/site-posts";
import { DeletePostDialog } from "@/components/site/DeletePostDialog";
import type { SitePost } from "@/lib/queries/site-posts";

/** Posts have no manual drag-reorder like PagesManager — a blog is
 * chronological by nature, sorted newest-first by created_at (dashboard) /
 * published_at (public archive), not a hand-arranged sequence. */
export function PostsManager({
  siteId,
  siteUrl,
  posts,
  canEdit,
}: {
  siteId: string;
  siteUrl: string;
  posts: SitePost[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostRow key={post.id} post={post} siteId={siteId} siteUrl={siteUrl} canEdit={canEdit} />
      ))}
    </div>
  );
}

function PostRow({ post, siteId, siteUrl, canEdit }: { post: SitePost; siteId: string; siteUrl: string; canEdit: boolean }) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-[var(--foreground)] truncate">{post.title}</p>
          {post.status === "published" ? (
            <Link
              href={`${siteUrl}/blog/${post.slug}`}
              target="_blank"
              title="Open in a new tab"
              className="text-xs text-[var(--muted-foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-colors"
            >
              /blog/{post.slug}
            </Link>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono">
              /blog/{post.slug}
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            post.status === "published" ? "bg-green-100 text-green-700" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
          }`}>
            {post.status}
          </span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          {post.published_at ? `Published ${format(new Date(post.published_at), "MMM d, yyyy")}` : `Updated ${format(new Date(post.updated_at), "MMM d")}`}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {canEdit && (
          <button
            onClick={() => startTransition(() => { togglePostPublished(post.id, siteId, post.status !== "published"); })}
            className={
              post.status === "published"
                ? "flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
                : "flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors"
            }
          >
            {post.status === "published" ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
          </button>
        )}
        <Link
          href={`/my-site/${siteId}/posts/${post.id}/edit`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors"
        >
          {canEdit ? <><Pencil size={13} /> Edit</> : "View"}
        </Link>
        {canEdit && <DeletePostDialog postId={post.id} siteId={siteId} postTitle={post.title} />}
      </div>
    </div>
  );
}
