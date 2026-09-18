"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setUserRole } from "@/lib/actions/admin-users";
import { toggleUserAiAccess, toggleUserFinanceAiAccess } from "@/lib/actions/admin";

const ROLES = ["member", "manager", "customer_success", "admin"] as const;

export function RoleSelector({ userId, initialRole, canEdit }: { userId: string; initialRole: string; canEdit: boolean }) {
  const [role, setRole] = useState(initialRole);
  const [isPending, startTransition] = useTransition();

  if (!canEdit) {
    return <span className="text-sm font-medium capitalize">{role.replace("_", " ")}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          setRole(next);
          startTransition(() => { setUserRole(userId, next); });
        }}
        className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r.replace("_", " ")}</option>
        ))}
      </select>
      {isPending && <Loader2 size={13} className="animate-spin text-[var(--muted-foreground)]" />}
    </div>
  );
}

export function AiAccessToggles({
  userId,
  initialSiteEnabled,
  initialFinanceEnabled,
  canEdit,
}: {
  userId: string;
  initialSiteEnabled: boolean;
  initialFinanceEnabled: boolean;
  canEdit: boolean;
}) {
  const [siteEnabled, setSiteEnabled] = useState(initialSiteEnabled);
  const [financeEnabled, setFinanceEnabled] = useState(initialFinanceEnabled);
  const [, startTransition] = useTransition();

  function Toggle({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
    return (
      <button
        onClick={canEdit ? onClick : undefined}
        disabled={!canEdit}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          enabled ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
        } ${canEdit ? "hover:opacity-80" : "opacity-70 cursor-default"}`}
      >
        {label}: {enabled ? "Enabled" : "Disabled"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Toggle
        label="Site editor AI"
        enabled={siteEnabled}
        onClick={() => { const next = !siteEnabled; setSiteEnabled(next); startTransition(() => { toggleUserAiAccess(userId, next); }); }}
      />
      <Toggle
        label="Finance AI"
        enabled={financeEnabled}
        onClick={() => { const next = !financeEnabled; setFinanceEnabled(next); startTransition(() => { toggleUserFinanceAiAccess(userId, next); }); }}
      />
    </div>
  );
}
