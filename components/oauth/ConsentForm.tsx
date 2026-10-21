"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveConsent, denyConsent } from "@/lib/actions/oauth-consent";
import type { Module } from "@/lib/server/auth/principal";

export function ConsentForm({
  requestId,
  modules,
}: {
  requestId: string;
  modules: { key: Module; label: string }[];
}) {
  const [selected, setSelected] = useState<Record<Module, boolean>>(
    Object.fromEntries(modules.map((m) => [m.key, true])) as Record<Module, boolean>
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    const granted = modules.map((m) => m.key).filter((k) => selected[k]);
    startTransition(async () => {
      const result = await approveConsent(requestId, granted);
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
      <div className="space-y-2">
        {modules.map((m) => (
          <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected[m.key]}
              onChange={(e) => setSelected((prev) => ({ ...prev, [m.key]: e.target.checked }))}
              className="h-4 w-4 rounded border-[var(--border)]"
            />
            {m.label}
          </label>
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
