"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BrainCircuit, Receipt, ShieldCheck, DollarSign } from "lucide-react";

const TABS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, staffOnly: true },
  { href: "/admin/users", label: "Users", icon: Users, staffOnly: false },
  { href: "/admin/pricing", label: "Pricing", icon: DollarSign, staffOnly: true },
  { href: "/admin/ai", label: "AI Settings", icon: BrainCircuit, staffOnly: true },
  { href: "/admin/finance", label: "Finance AI Runs", icon: Receipt, staffOnly: true },
  { href: "/admin/legal", label: "Legal", icon: ShieldCheck, staffOnly: true },
];

/** staffOnly here means "admin/manager only" — customer_success only ever
 * sees Overview... actually Overview is manager-only too; customer_success
 * lands straight on Users, so it renders just that one tab. */
export function AdminNav({ canManage }: { canManage: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => canManage || !t.staffOnly);

  return (
    <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
