"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Copy, Check, UserPlus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
} from "@/lib/actions/site-collaborators";
import type { SiteCollaborator } from "@/lib/queries/site-collaborators";

type Role = "viewer" | "editor" | "manager";

const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer — can view only",
  editor: "Editor — can edit content",
  manager: "Manager — can also manage access",
};

function originFromWindow() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function CollaboratorsPanel({
  siteId,
  collaborators,
}: {
  siteId: string;
  collaborators: SiteCollaborator[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleInvite() {
    if (!email.trim()) return;
    setError(null);
    setNewLink(null);
    startTransition(async () => {
      const result = await inviteCollaborator(siteId, email.trim(), role);
      if (result.error || !result.collaborator) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setNewLink(`${originFromWindow()}/invite/${result.collaborator.invite_token}`);
      setEmail("");
      router.refresh();
    });
  }

  function handleCopy(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRoleChange(collaboratorId: string, newRole: Role) {
    startTransition(async () => {
      await updateCollaboratorRole(collaboratorId, newRole);
      router.refresh();
    });
  }

  function handleRemove(collaboratorId: string) {
    if (!confirm("Remove this collaborator's access to the site?")) return;
    startTransition(async () => {
      await removeCollaborator(collaboratorId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-1.5">
          <UserPlus size={16} /> Collaborators
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Invite others to view or edit this site. They&apos;ll get a link — once they log in (or sign up) with any account, access activates.
        </p>
      </div>

      {collaborators.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {collaborators.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.email}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {c.status === "pending" ? "Invited — not yet accepted" : "Active"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={c.role}
                  onChange={(e) => handleRoleChange(c.id, e.target.value as Role)}
                  disabled={isPending}
                  className="text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="manager">Manager</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(c.id)}
                  disabled={isPending}
                  className="text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <Label htmlFor="invite-email">Invite someone</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="artist@email.com"
            className="flex-1 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30"
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <Button onClick={handleInvite} disabled={isPending || !email.trim()} size="sm">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : "Invite"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {newLink && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Link2 size={14} className="text-emerald-600 flex-shrink-0" />
            <code className="text-xs flex-1 truncate text-[var(--foreground)]">{newLink}</code>
            <Button variant="ghost" size="sm" onClick={() => handleCopy(newLink)} className="flex-shrink-0">
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </Button>
          </div>
        )}
        <p className="text-xs text-[var(--muted-foreground)]">
          There&apos;s no email sent automatically — copy the link above and send it to them yourself.
        </p>
      </div>
    </div>
  );
}
