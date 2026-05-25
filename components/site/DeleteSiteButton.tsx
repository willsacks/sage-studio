"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSite } from "@/lib/actions/sites";

export function DeleteSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFirstClick() {
    setConfirming(true);
  }

  function handleCancel() {
    setConfirming(false);
  }

  function handleConfirm() {
    startTransition(async () => {
      await deleteSite(siteId);
      router.push("/my-site");
    });
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={handleFirstClick}
        className="text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10"
      >
        <Trash2 size={14} /> Delete site
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-red-500">
        Delete <span className="font-semibold">{siteName}</span> and all its pages? This cannot be undone.
      </p>
      <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isPending}
        className="text-[var(--muted-foreground)] shrink-0"
      >
        Cancel
      </Button>
      <Button size="sm" onClick={handleConfirm} disabled={isPending}
        className="bg-red-600 hover:bg-red-700 text-white shrink-0"
      >
        {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        Yes, delete
      </Button>
    </div>
  );
}
