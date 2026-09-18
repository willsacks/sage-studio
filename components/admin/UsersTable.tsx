"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AdminUserRow } from "@/lib/queries/admin";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  customer_success: "Customer Success",
  member: "Member",
  moderator: "Moderator",
};

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => u.email.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q))
    : users;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, username, or email" className="pl-9" />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">No users found.</p>
        ) : (
          filtered.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--accent)] transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.display_name ?? u.username ?? u.email}</p>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[var(--muted-foreground)]">{u.tier_key === "studio_pro" ? "Pro" : "Free"}</span>
                {u.role !== "member" && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
