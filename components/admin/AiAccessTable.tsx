"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toggleUserAiAccess } from "@/lib/actions/admin";

export interface UserRow {
  id: string;
  display_name: string | null;
  email: string;
  tier_key: string;
  ai_assistant_enabled: boolean;
}

export function AiAccessTable({ users }: { users: UserRow[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(users.map((u) => [u.id, u.ai_assistant_enabled]))
  );
  const [pending, startTransition] = useTransition();
  const [toggling, setToggling] = useState<string | null>(null);

  function handleToggle(userId: string) {
    const next = !states[userId];
    setToggling(userId);
    setStates((s) => ({ ...s, [userId]: next }));
    startTransition(async () => {
      await toggleUserAiAccess(userId, next);
      setToggling(null);
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
      {users.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">No users found.</p>
      ) : (
        users.map((user) => {
          const enabled = states[user.id];
          const isToggling = toggling === user.id;
          return (
            <div key={user.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.display_name ?? user.email}</p>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{user.email} · {user.tier_key ?? "free"}</p>
              </div>
              <button
                onClick={() => handleToggle(user.id)}
                disabled={pending}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                  enabled
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-80"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                {isToggling ? <Loader2 size={11} className="animate-spin" /> : null}
                {enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
