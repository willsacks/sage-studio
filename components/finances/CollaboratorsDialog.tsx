"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Copy, Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  listFinanceCollaborators,
  inviteFinanceCollaborator,
  updateFinanceCollaboratorRole,
  removeFinanceCollaborator,
} from "@/lib/actions/finance-collaborators";

type Role = "viewer" | "editor" | "manager";
type Collaborator = { id: string; email: string | null; role: Role | "owner"; status: "pending" | "accepted"; invite_token: string | null };

const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer — can view only",
  editor: "Editor — can categorize & flag for review",
  manager: "Manager — can also manage access",
};

function originFromWindow() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function CollaboratorsDialog({ entityId, entityName, onClose }: { entityId: string; entityName: string; onClose: () => void }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listFinanceCollaborators(entityId);
    setCollaborators((result.collaborators ?? []) as Collaborator[]);
    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleInvite() {
    if (!email.trim()) return;
    setError(null);
    setNewLink(null);
    setInviting(true);
    try {
      const result = await inviteFinanceCollaborator(entityId, email.trim(), role);
      if (result.error || !result.collaborator) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setNewLink(`${originFromWindow()}/finance-invite/${result.collaborator.invite_token}`);
      setEmail("");
      refresh();
    } catch (err) {
      // requireFinanceEntityRole throws rather than returning an error object
      // when the caller isn't authorized — without this catch, a non-manager
      // collaborator opening this dialog would leave the button stuck
      // spinning forever since setInviting(false) below would never run.
      setError(err instanceof Error ? err.message : "You don't have permission to invite collaborators");
    } finally {
      setInviting(false);
    }
  }

  function handleCopy(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRoleChange(collaboratorId: string, newRole: Role) {
    setError(null);
    try {
      const result = await updateFinanceCollaboratorRole(collaboratorId, newRole);
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "You don't have permission to change roles");
    }
    refresh();
  }

  async function handleRemove(collaboratorId: string) {
    setError(null);
    try {
      const result = await removeFinanceCollaborator(collaboratorId);
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "You don't have permission to remove collaborators");
    }
    refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto space-y-4">
        <DialogHeader>
          <DialogTitle>Share access — {entityName}</DialogTitle>
          <DialogDescription>Invite a bookkeeper or accountant to help manage these books.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" /></div>
        ) : (
          collaborators.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.email}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{c.status === "pending" ? "Invited — not yet accepted" : "Active"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <select
                      value={c.role}
                      onChange={(e) => handleRoleChange(c.id, e.target.value as Role)}
                      className="text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-1.5 py-1"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button onClick={() => handleRemove(c.id)} className="p-1 text-[var(--muted-foreground)] hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bookkeeper@email.com" className="flex-1 h-9 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleInvite} disabled={inviting || !email.trim()}>
              {inviting ? <Loader2 size={13} className="animate-spin" /> : "Invite"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {newLink && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <Link2 size={13} className="text-emerald-600 flex-shrink-0" />
              <code className="text-xs flex-1 truncate">{newLink}</code>
              <button onClick={() => handleCopy(newLink)} className="flex-shrink-0">
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              </button>
            </div>
          )}
          <p className="text-xs text-[var(--muted-foreground)]">Copy the link and share it however you'd like — nothing is emailed automatically.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
