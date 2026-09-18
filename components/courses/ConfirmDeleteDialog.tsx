"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/** Same "type DELETE to confirm" pattern as DeletePostDialog.tsx/
 * DeletePageDialog.tsx, generalized as a controlled dialog since a
 * module/lesson delete is triggered from an inline icon button already
 * embedded in a row, not a standalone trigger of its own. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | unknown;
}) {
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (typed !== "DELETE") return;
    startTransition(async () => {
      await onConfirm();
      setTyped("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setTyped(""); onOpenChange(v); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={typed !== "DELETE" || isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
