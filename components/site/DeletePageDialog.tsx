"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { deleteSitePage } from "@/lib/actions/sites";

export function DeletePageDialog({
  pageId,
  siteId,
  pageTitle,
}: {
  pageId: string;
  siteId: string;
  pageTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setTyped("");
    setOpen(true);
  }

  function handleConfirm() {
    if (typed !== "DELETE") return;
    startTransition(async () => {
      await deleteSitePage(pageId, siteId);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="text-[var(--muted-foreground)] hover:text-red-500 w-8 p-0"
      >
        <Trash2 size={13} />
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete page?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-[var(--foreground)]">{pageTitle}</span> will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-[var(--muted-foreground)]">
              Type <span className="font-mono font-semibold text-[var(--foreground)]">DELETE</span> to confirm.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              placeholder="DELETE"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={typed !== "DELETE" || isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete page
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
