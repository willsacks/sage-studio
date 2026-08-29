"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NAV } from "@/components/nav/Sidebar";
import { setHiddenNavItems } from "@/lib/actions/profile";
import { Switch } from "@/components/ui/switch";

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
        <div
          key={item.href}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--accent)]"
        >
          <span className="flex items-center gap-2 text-sm">
            <item.icon size={15} className="text-[var(--muted-foreground)]" />
            {item.label}
          </span>
          <Switch
            checked={!hidden.includes(item.href)}
            onCheckedChange={() => toggle(item.href)}
            disabled={isPending}
            aria-label={`Show ${item.label} in menu`}
          />
        </div>
      ))}
    </div>
  );
}
