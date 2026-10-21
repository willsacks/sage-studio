"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createAssistantConnection,
  revokeAssistantConnection,
  type ConnectionRow,
} from "@/lib/actions/assistant-connections";
import type { Module, ScopeLevel } from "@/lib/server/auth/principal";

const MODULE_LABELS: Record<Module, string> = {
  todos: "To-dos",
  knowledge: "Knowledge base",
  time_tracking: "Time tracking",
  sites: "Websites",
  finance: "Finance",
  courses: "Courses",
};

const MODULE_ORDER: Module[] = ["todos", "knowledge", "time_tracking", "sites", "finance", "courses"];

function emptyScopes(): Record<Module, boolean> {
  return Object.fromEntries(MODULE_ORDER.map((m) => [m, false])) as Record<Module, boolean>;
}

export function AssistantConnections({ initialConnections }: { initialConnections: ConnectionRow[] }) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Record<Module, boolean>>(emptyScopes());
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [, startRevoking] = useTransition();

  function openCreate() {
    setName("");
    setSelected(emptyScopes());
    setError(null);
    setCreateOpen(true);
  }

  function handleCreate() {
    setError(null);
    const scopes: Partial<Record<Module, ScopeLevel>> = {};
    for (const m of MODULE_ORDER) {
      if (selected[m]) scopes[m] = "read";
    }
    startCreating(async () => {
      const result = await createAssistantConnection(name, scopes);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("token" in result && result.token) {
        setCreateOpen(false);
        setRevealedToken(result.token);
        router.refresh();
      }
    });
  }

  function handleRevoke(id: string) {
    setRevokingId(id);
    startRevoking(async () => {
      await revokeAssistantConnection(id);
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: "revoked" } : c)));
      setRevokingId(null);
      router.refresh();
    });
  }

  async function copyToken() {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          Give an AI assistant (Grok, ChatGPT, Claude, Cursor, etc.) read access to parts of your Sage Studio account.
        </p>
        <Button size="sm" onClick={openCreate}>New connection</Button>
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No connections yet.</p>
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {connections.map((c) => {
            const grantedModules = MODULE_ORDER.filter((m) => (c.scopes[m] ?? "none") !== "none");
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.displayName}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {grantedModules.length > 0
                      ? grantedModules.map((m) => MODULE_LABELS[m]).join(", ")
                      : "No access"}
                    {c.status !== "active" && <span className="ml-2 text-red-500">Revoked</span>}
                  </p>
                </div>
                {c.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRevoke(c.id)}
                    disabled={revokingId === c.id}
                  >
                    {revokingId === c.id && <Loader2 size={13} className="animate-spin mr-1.5" />}
                    Revoke
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New connection</DialogTitle>
            <DialogDescription>
              This gives read-only access to the modules you choose below. Writing (e.g. adding to-dos) isn't supported yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="connection-name">Name</Label>
              <Input
                id="connection-name"
                placeholder="e.g. Grok"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Access</Label>
              <div className="space-y-2">
                {MODULE_ORDER.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected[m]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [m]: e.target.checked }))}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    {MODULE_LABELS[m]}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Create connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revealedToken}
        onOpenChange={(open) => {
          if (!open) {
            setRevealedToken(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your access token</DialogTitle>
            <DialogDescription>
              Copy this now — you won't be able to see it again. Paste it into your assistant wherever it asks for an API key or bearer token.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
            <code className="flex-1 text-xs font-mono break-all">{revealedToken}</code>
            <Button size="sm" variant="outline" onClick={copyToken}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealedToken(null);
                setCopied(false);
              }}
            >
              I've copied it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
