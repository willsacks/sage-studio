"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Leaf, LogOut, Menu, X } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { NavLinks } from "@/components/nav/Sidebar";

interface MobileNavProps {
  displayName: string | null;
  plan: "free" | "pro";
  isAdmin?: boolean;
}

export function MobileNav({ displayName, plan, isAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation happens.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--sidebar-border)] bg-[var(--sidebar-background)] sticky top-0 z-30">
        <Link href="/my-site" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
            <Leaf size={13} className="text-[var(--primary-foreground)]" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Sage Studio</span>
        </Link>
        <DialogPrimitive.Trigger asChild>
          <button
            aria-label="Open menu"
            className="p-2 -mr-2 rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] transition-colors"
          >
            <Menu size={20} />
          </button>
        </DialogPrimitive.Trigger>
      </div>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-[var(--sidebar-background)] border-r border-[var(--sidebar-border)] lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--sidebar-border)]">
            <Link href="/my-site" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                <Leaf size={13} className="text-[var(--primary-foreground)]" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Sage Studio</span>
            </Link>
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close menu"
                className="p-1.5 -mr-1.5 rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] transition-colors"
              >
                <X size={18} />
              </button>
            </DialogPrimitive.Close>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            <NavLinks isAdmin={isAdmin} />
          </nav>

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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
