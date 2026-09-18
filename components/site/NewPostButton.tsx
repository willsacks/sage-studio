"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { addSitePost } from "@/lib/actions/site-posts";

export function NewPostButton({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await addSitePost(siteId, title);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setTitle("");
      router.push(`/my-site/${siteId}/posts/${result.postId}/edit`);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus size={13} /> New post
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
            <DialogDescription>Give it a title — you can change it and everything else after.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleCreate(); }}
              placeholder="e.g. What we learned this quarter"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={!title.trim() || isPending}>
                {isPending ? <Loader2 size={13} className="animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
