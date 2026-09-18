"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyUserDiscount, removeUserDiscount } from "@/lib/actions/admin-pricing";

export function DiscountForm({ userId, currentPercent }: { userId: string; currentPercent: number | null }) {
  const router = useRouter();
  const [percent, setPercent] = useState(currentPercent ? String(currentPercent) : "10");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const result = await applyUserDiscount(userId, parseFloat(percent));
      if (result?.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeUserDiscount(userId);
      if (result?.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {currentPercent ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">{currentPercent}% off active</span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">No discount</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input type="number" min="1" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} className="w-20 h-8" />
        <span className="text-sm text-[var(--muted-foreground)]">% off</span>
        <Button size="sm" variant="outline" onClick={handleApply} disabled={isPending}>
          {isPending && <Loader2 size={13} className="animate-spin mr-1" />}
          Apply
        </Button>
        {currentPercent !== null && (
          <Button size="sm" variant="ghost" onClick={handleRemove} disabled={isPending}>Remove</Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
