"use client";

import { useTransition } from "react";
import { Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setHomePage } from "@/lib/actions/sites";

export function SetHomePageButton({ siteId, pageId }: { siteId: string; pageId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await setHomePage(siteId, pageId);
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      title="Set as home page"
    >
      {isPending ? <Loader2 size={12} className="animate-spin" /> : <Home size={12} />}
    </Button>
  );
}
