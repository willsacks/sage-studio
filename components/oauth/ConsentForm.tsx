"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveConsent, denyConsent } from "@/lib/actions/oauth-consent";
import { MODULE_DISPLAY, sortByDisplayOrder } from "@/lib/module-display";
import type { Module, ScopeLevel } from "@/lib/server/auth/principal";

interface ModuleOption {
  key: Module;
  /** The ceiling — the most this module could be granted, per what the
   * client asked for (or, if it asked for nothing at all, every module
   * up to write). A module the client didn't ask write for at all
   * doesn't get an Edit checkbox — there's nothing to opt into. */
  requestedLevel: ScopeLevel;
  /** What's pre-checked when the screen first loads. Equal to
   * requestedLevel when the client explicitly asked for this level —
   * but when the client asked for nothing and the ceiling defaults to
   * "write" on its behalf, this still starts at "read", so granting
   * write is always something the user actively opts into here, never
   * something pre-selected on their behalf. */
  defaultLevel: ScopeLevel;
}

export function ConsentForm({
  requestId,
  modules,
}: {
  requestId: string;
  modules: ModuleOption[];
}) {
  const [selected, setSelected] = useState<Record<Module, ScopeLevel>>(
    Object.fromEntries(modules.map((m) => [m.key, m.defaultLevel])) as Record<Module, ScopeLevel>
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setLevel(key: Module, level: ScopeLevel) {
    setSelected((prev) => ({ ...prev, [key]: level }));
  }

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

  const orderedModules = sortByDisplayOrder(modules.map((m) => m.key))
    .map((key) => modules.find((m) => m.key === key)!);

  return (
    <div className="space-y-4">
      <div className="divide-y divide-[var(--border)]">
        {orderedModules.map((m) => {
          const { label, icon: Icon } = MODULE_DISPLAY[m.key];
          const level = selected[m.key];
          return (
            <div key={m.key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 text-sm font-medium mb-1.5">
                <Icon size={15} className="text-[var(--muted-foreground)]" />
                {label}
              </div>
              <div className="flex items-center gap-5 pl-[23px]">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={level !== "none"}
                    onChange={(e) => setLevel(m.key, e.target.checked ? "read" : "none")}
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  View
                </label>
                {m.requestedLevel === "write" && (
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={level === "write"}
                      onChange={(e) => setLevel(m.key, e.target.checked ? "write" : "read")}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    Edit
                  </label>
                )}
              </div>
            </div>
          );
        })}
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
