"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert, Landmark, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { renameFinanceEntity, deleteFinanceEntity } from "@/lib/actions/finance-entities";
import { getQboConnectionStatus, buildQboReconnectAuthUrl } from "@/lib/actions/finance-qbo";
import { getBooksLockStatus, closeBooksThrough, reopenBooks } from "@/lib/actions/finance-close";
import { today } from "./DateRangePicker";
import type { FinanceEntity } from "./FinancesApp";

type QboConnection = { status: "active" | "error" | "revoked"; environment: "sandbox" | "production" };

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

  const [qboConnection, setQboConnection] = useState<QboConnection | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  const [lockedThroughDate, setLockedThroughDate] = useState<string | null | undefined>(undefined);
  const [closeDate, setCloseDate] = useState(today());
  const [closingBooks, setClosingBooks] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  useEffect(() => {
    getQboConnectionStatus(entity.id).then((result) => {
      if (result.connection) setQboConnection(result.connection as QboConnection);
    });
    getBooksLockStatus(entity.id).then((result) => setLockedThroughDate(result.lockedThroughDate ?? null));
  }, [entity.id]);

  async function handleCloseBooks() {
    setClosingBooks(true);
    setCloseError(null);
    const result = await closeBooksThrough(entity.id, closeDate);
    setClosingBooks(false);
    if (result.error) {
      setCloseError(result.error);
      return;
    }
    setLockedThroughDate(closeDate);
  }

  async function handleReopenBooks() {
    setClosingBooks(true);
    setCloseError(null);
    const result = await reopenBooks(entity.id);
    setClosingBooks(false);
    if (result.error) {
      setCloseError(result.error);
      return;
    }
    setLockedThroughDate(null);
  }

  async function handleReconnect() {
    setReconnecting(true);
    setReconnectError(null);
    try {
      const result = await buildQboReconnectAuthUrl(entity.id);
      window.location.href = result.authUrl;
    } catch (err) {
      setReconnecting(false);
      setReconnectError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

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

        {lockedThroughDate !== undefined && (
          <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
            <div className="flex items-center gap-2">
              {lockedThroughDate ? <Lock size={15} className="text-[var(--muted-foreground)]" /> : <LockOpen size={15} className="text-[var(--muted-foreground)]" />}
              <p className="text-sm font-medium">Close the books</p>
            </div>
            {lockedThroughDate ? (
              <>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Closed through <strong className="text-[var(--foreground)]">{lockedThroughDate}</strong> — no transaction or journal entry dated on or before this date can be added, edited, or deleted.
                </p>
                <Button size="sm" variant="outline" onClick={handleReopenBooks} disabled={closingBooks}>
                  {closingBooks ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                  Reopen books
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Once a month is signed off, close it through that date so it can&apos;t change later without deliberately reopening it.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  />
                  <Button size="sm" onClick={handleCloseBooks} disabled={closingBooks || !closeDate}>
                    {closingBooks ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                    Close through this date
                  </Button>
                </div>
              </>
            )}
            {closeError && <p className="text-xs text-red-500">{closeError}</p>}
          </div>
        )}

        {qboConnection && (
          <div className={`rounded-xl border p-4 space-y-2 ${qboConnection.status === "active" ? "border-[var(--border)]" : "border-amber-500/30 bg-amber-500/5"}`}>
            <div className="flex items-center gap-2">
              <Landmark size={15} className="text-[var(--muted-foreground)]" />
              <p className="text-sm font-medium">QuickBooks connection</p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {qboConnection.status === "active"
                ? "Connected and active."
                : qboConnection.status === "revoked"
                ? "Disconnected — reconnect if you need to import more data from this company."
                : "This connection needs attention (expired or revoked access) — reconnect to fix it."}
            </p>
            {qboConnection.status !== "active" && (
              <Button size="sm" variant="outline" onClick={handleReconnect} disabled={reconnecting}>
                {reconnecting ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                Reconnect QuickBooks
              </Button>
            )}
            {reconnectError && <p className="text-xs text-red-500">{reconnectError}</p>}
          </div>
        )}

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
