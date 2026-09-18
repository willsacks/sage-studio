"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/** A collapsible wrapper for the Pages/Blog Posts/Form Submissions sections
 * on a site's dashboard — useful once a site accumulates a lot of either.
 * The open/closed state is a per-viewer convenience (which sections you
 * left collapsed), so it's fine to keep in localStorage rather than the
 * database; it defaults to open and simply fails open if storage is
 * unavailable (private browsing, etc). */
export function CollapsibleSection({
  storageKey,
  title,
  badge,
  actions,
  children,
}: {
  storageKey: string;
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`sage:collapsible:${storageKey}`);
      if (stored !== null) setOpen(stored === "1");
    } catch {
      // ignore — defaults to open
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(`sage:collapsible:${storageKey}`, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {title}
          {badge}
        </button>
        {actions}
      </div>
      <div style={{ display: hydrated && !open ? "none" : "block" }}>{children}</div>
    </div>
  );
}
