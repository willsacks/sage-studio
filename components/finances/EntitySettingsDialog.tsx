"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { renameFinanceEntity, deleteFinanceEntity } from "@/lib/actions/finance-entities";
import type { FinanceEntity } from "./FinancesApp";

export function EntitySettingsDialog({
  entity,
  onClose,
  onRenamed,
  onDeleted,
}: {
  entity: FinanceEntity;
  onClose: () => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(entity.name);
  const [savingName, setSavingName] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleRename() {
    if (!name.trim() || name.trim() === entity.name) return;
    setSavingName(true);
    setRenameError(null);
    const result = await renameFinanceEntity(entity.id, name);
    setSavingName(false);
    if (result.error) {
      setRenameError(result.error);
      return;
    }
    onRenamed(name.trim());
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteFinanceEntity(entity.id);
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md space-y-5">
        <DialogHeader>
          <DialogTitle>{entity.name} — Settings</DialogTitle>
          <DialogDescription>Rename these books or permanently delete them.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Name</label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm flex-1 min-w-0" />
            <Button size="sm" onClick={handleRename} disabled={savingName || !name.trim() || name.trim() === entity.name}>
              {savingName ? <Loader2 size={13} className="animate-spin" /> : "Save"}
            </Button>
          </div>
          {renameError && <p className="text-sm text-red-500">{renameError}</p>}
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <TriangleAlert size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-600">Delete these books</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                This permanently deletes every transaction, project, invoice, bank connection, and chart of accounts
                entry in <strong>{entity.name}</strong>. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Type <strong className="text-[var(--foreground)]">{entity.name}</strong> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="h-9 text-sm"
              autoComplete="off"
            />
          </div>
          {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || confirmText !== entity.name}
          >
            {deleting ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
            Permanently delete {entity.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
