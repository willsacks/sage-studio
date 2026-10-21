"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Copy, Sparkles, KeyRound } from "lucide-react";
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

const MODULE_INFO: Record<Module, { label: string; hint: string }> = {
  todos: { label: "To-dos", hint: "see and add items on your to-do list" },
  knowledge: { label: "Knowledge base", hint: "search and read your knowledge base articles" },
  time_tracking: { label: "Time tracking", hint: "see your tracked time entries" },
  sites: { label: "Websites", hint: "see your site pages" },
  finance: { label: "Finance", hint: "see transactions, accounts, and reports" },
  courses: { label: "Courses", hint: "see your courses and enrollment counts" },
};

const MODULE_ORDER: Module[] = ["todos", "knowledge", "time_tracking", "sites", "finance", "courses"];

function emptyScopes(): Record<Module, boolean> {
  return Object.fromEntries(MODULE_ORDER.map((m) => [m, false])) as Record<Module, boolean>;
}

function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
      <code className={`flex-1 text-xs break-all ${mono ? "font-mono" : ""}`}>{value}</code>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </Button>
    </div>
  );
}

export function AssistantConnections({ initialConnections }: { initialConnections: ConnectionRow[] }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [connections, setConnections] = useState(initialConnections);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Record<Module, boolean>>(emptyScopes());
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [, startRevoking] = useTransition();

  useEffect(() => setOrigin(window.location.origin), []);

  const mcpUrl = origin ? `${origin}/api/mcp` : "";
  const mcpConfigSnippet = origin
    ? JSON.stringify({ mcpServers: { "Sage Studio": { url: mcpUrl } } }, null, 2)
    : "";

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

  return (
    <div className="space-y-6">
      {/* Path 1: OAuth-capable assistants — just paste a URL, no token to manage */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles size={16} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Recommended: Claude, ChatGPT, or Cursor</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              These can connect directly — paste this URL into your assistant&apos;s connector/MCP settings. It will ask you to log in and choose what to share; no password or key to copy.
            </p>
          </div>
        </div>
        {mcpUrl && (
          <div className="space-y-2 pl-6">
            <CopyField value={mcpUrl} />
            <details className="text-xs text-[var(--muted-foreground)]">
              <summary className="cursor-pointer hover:text-[var(--foreground)]">Using a config file instead? (Claude Desktop, Cursor)</summary>
              <pre className="mt-2 rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 overflow-x-auto font-mono text-[11px] leading-relaxed">{mcpConfigSnippet}</pre>
            </details>
          </div>
        )}
      </div>

      {/* Path 2: API-key-only assistants (Grok, custom bots) */}
      <div className="space-y-3">
        <div className="flex items-start gap-2 justify-between">
          <div className="flex items-start gap-2">
            <KeyRound size={16} className="text-[var(--muted-foreground)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Other assistants (Grok, custom bots)</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                If your assistant only takes an API key — not a connector URL — create one here instead.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="flex-shrink-0">Create API key</Button>
        </div>

        {connections.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] pl-6">No connections yet.</p>
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
                        ? grantedModules.map((m) => MODULE_INFO[m].label).join(", ")
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
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create an API key</DialogTitle>
            <DialogDescription>
              Grants read-only access to whatever you check below. Your assistant can look but can&apos;t change or delete anything yet.
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
              <Label>What can it see?</Label>
              <div className="space-y-2.5">
                {MODULE_ORDER.map((m) => (
                  <label key={m} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected[m]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [m]: e.target.checked }))}
                      className="h-4 w-4 rounded border-[var(--border)] mt-0.5"
                    />
                    <span>
                      <span className="font-medium">{MODULE_INFO[m].label}</span>
                      <span className="text-[var(--muted-foreground)]"> — {MODULE_INFO[m].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revealedToken}
        onOpenChange={(open) => {
          if (!open) setRevealedToken(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your API key</DialogTitle>
            <DialogDescription>
              Copy this now — you won&apos;t be able to see it again. Give your assistant both this key and the server address below (most ask for them as &quot;API key&quot; and &quot;base URL&quot;, or sometimes just &quot;bearer token&quot;).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-[var(--muted-foreground)]">API key</Label>
              {revealedToken && <CopyField value={revealedToken} />}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-[var(--muted-foreground)]">Server address</Label>
              {mcpUrl && <CopyField value={mcpUrl} />}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedToken(null)}>I&apos;ve copied it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
