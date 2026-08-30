"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toggleUserAiAccess, toggleUserFinanceAiAccess } from "@/lib/actions/admin";

export interface UserRow {
  id: string;
  display_name: string | null;
  email: string;
  tier_key: string;
  ai_assistant_enabled: boolean;
  ai_finance_assistant_enabled: boolean;
}

function ToggleButton({
  label,
  enabled,
  toggling,
  disabled,
  onClick,
}: {
  label: string;
  enabled: boolean;
  toggling: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
        enabled
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-80"
          : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
      }`}
    >
      {toggling ? <Loader2 size={11} className="animate-spin" /> : null}
      {label}: {enabled ? "Enabled" : "Disabled"}
    </button>
  );
}

export function AiAccessTable({ users }: { users: UserRow[] }) {
  const [siteStates, setSiteStates] = useState<Record<string, boolean>>(
    Object.fromEntries(users.map((u) => [u.id, u.ai_assistant_enabled]))
  );
  const [financeStates, setFinanceStates] = useState<Record<string, boolean>>(
    Object.fromEntries(users.map((u) => [u.id, u.ai_finance_assistant_enabled]))
  );
  const [pending, startTransition] = useTransition();
  const [toggling, setToggling] = useState<string | null>(null);

  function handleToggleSite(userId: string) {
    const next = !siteStates[userId];
    setToggling(`site:${userId}`);
    setSiteStates((s) => ({ ...s, [userId]: next }));
    startTransition(async () => {
      await toggleUserAiAccess(userId, next);
      setToggling(null);
    });
  }

  function handleToggleFinance(userId: string) {
    const next = !financeStates[userId];
    setToggling(`finance:${userId}`);
    setFinanceStates((s) => ({ ...s, [userId]: next }));
    startTransition(async () => {
      await toggleUserFinanceAiAccess(userId, next);
      setToggling(null);
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
      {users.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">No users found.</p>
      ) : (
        users.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.display_name ?? user.email}</p>
              <p className="text-xs text-[var(--muted-foreground)] truncate">{user.email} · {user.tier_key ?? "free"}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ToggleButton
                label="Site editor"
                enabled={siteStates[user.id]}
                toggling={toggling === `site:${user.id}`}
                disabled={pending}
                onClick={() => handleToggleSite(user.id)}
              />
              <ToggleButton
                label="Finance AI"
                enabled={financeStates[user.id]}
                toggling={toggling === `finance:${user.id}`}
                disabled={pending}
                onClick={() => handleToggleFinance(user.id)}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
