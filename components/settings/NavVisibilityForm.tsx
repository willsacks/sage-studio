"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NAV } from "@/components/nav/Sidebar";
import { setHiddenNavItems } from "@/lib/actions/profile";

export function NavVisibilityForm({ initialHidden }: { initialHidden: string[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [isPending, startTransition] = useTransition();

  function toggle(href: string) {
    const next = hidden.includes(href) ? hidden.filter((h) => h !== href) : [...hidden, href];
    setHidden(next);
    startTransition(async () => {
      await setHiddenNavItems(next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      {NAV.map((item) => (
        <label
          key={item.href}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--accent)] cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm">
            <item.icon size={15} className="text-[var(--muted-foreground)]" />
            {item.label}
          </span>
          <input
            type="checkbox"
            checked={!hidden.includes(item.href)}
            onChange={() => toggle(item.href)}
            disabled={isPending}
            className="rounded"
          />
        </label>
      ))}
    </div>
  );
}
