"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveConsent, denyConsent } from "@/lib/actions/oauth-consent";
import type { Module, ScopeLevel } from "@/lib/server/auth/principal";

interface ModuleOption {
  key: Module;
  label: string;
  requestedLevel: ScopeLevel;
  writable: boolean;
}

export function ConsentForm({
  requestId,
  modules,
}: {
  requestId: string;
  modules: ModuleOption[];
}) {
  // Defaults to exactly what was requested — the user can narrow (uncheck,
  // or downgrade write to read) but never grant more than the client asked
  // for in the first place.
  const [selected, setSelected] = useState<Record<Module, ScopeLevel>>(
    Object.fromEntries(modules.map((m) => [m.key, m.requestedLevel])) as Record<Module, ScopeLevel>
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    const granted = modules.map((m) => m.key).filter((k) => selected[k] !== "none");
    const levels = Object.fromEntries(granted.map((k) => [k, selected[k]])) as Record<Module, ScopeLevel>;
    startTransition(async () => {
      const result = await approveConsent(requestId, granted, levels);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.redirectTo) window.location.href = result.redirectTo;
    });
  }

  function handleDeny() {
    startTransition(async () => {
      const result = await denyConsent(requestId);
      if (result.redirectTo) window.location.href = result.redirectTo;
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {modules.map((m) => (
          <div key={m.key} className="space-y-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected[m.key] !== "none"}
                onChange={(e) => setSelected((prev) => ({ ...prev, [m.key]: e.target.checked ? m.requestedLevel : "none" }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              {m.label}
              {m.requestedLevel === "write" && <span className="text-xs text-[var(--muted-foreground)]">(view & edit)</span>}
            </label>
            {m.writable && m.requestedLevel === "write" && selected[m.key] !== "none" && (
              <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] cursor-pointer pl-6">
                <input
                  type="checkbox"
                  checked={selected[m.key] === "write"}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [m.key]: e.target.checked ? "write" : "read" }))}
                  className="h-3.5 w-3.5 rounded border-[var(--border)]"
                />
                Allow edits, not just viewing
              </label>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={handleApprove} disabled={pending}>
          {pending && <Loader2 size={13} className="animate-spin mr-1.5" />}
          Allow
        </Button>
        <Button className="flex-1" variant="outline" onClick={handleDeny} disabled={pending}>
          Deny
        </Button>
      </div>
    </div>
  );
}
