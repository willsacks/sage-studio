"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Timer, Store, CreditCard, Settings, Leaf, LogOut, ExternalLink } from "lucide-react";
import { signOut } from "@/lib/actions/auth";

interface SidebarProps {
  displayName: string | null;
  plan: "free" | "pro";
}

const NAV = [
  { href: "/my-site", label: "My Websites", icon: Globe },
  { href: "/tasks", label: "Time Tracker", icon: Timer },
  { href: "/my-templates", label: "My Templates", icon: Store },
];

const SETTINGS_NAV = [
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
        active
          ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-primary)] font-medium"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
      }`}
    >
      <Icon size={16} className="flex-shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar({ displayName, plan }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-[var(--sidebar-background)] border-r border-[var(--sidebar-border)] h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--sidebar-border)]">
        <Link href="/my-site" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
            <Leaf size={13} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Sage Studio</span>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Account
          </p>
        </div>
        {SETTINGS_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {/* CC crosslink */}
        <div className="pt-4">
          <a
            href="https://creatorscircle.art"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] transition-colors"
          >
            <ExternalLink size={13} className="flex-shrink-0" />
            Join Creator Circle
          </a>
        </div>
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-[var(--sidebar-border)] space-y-1">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-[var(--primary)]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-semibold text-[var(--primary)]">
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{displayName ?? "Artist"}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] capitalize">{plan}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
