"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCoursePlatformFeeOverride } from "@/lib/actions/admin-course-fee";

export function CourseFeeForm({ userId, currentBps }: { userId: string; currentBps: number | null }) {
  const router = useRouter();
  const [percent, setPercent] = useState(currentBps !== null ? String(currentBps / 100) : "0");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const result = await setCoursePlatformFeeOverride(userId, parseFloat(percent));
      if (result?.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await setCoursePlatformFeeOverride(userId, null);
      if (result?.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {currentBps !== null ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{currentBps / 100}% override active</span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">No override — default 0%</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input type="number" min="0" max="100" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} className="w-20 h-8" />
        <span className="text-sm text-[var(--muted-foreground)]">% platform fee on course sales</span>
        <Button size="sm" variant="outline" onClick={handleApply} disabled={isPending}>
          {isPending && <Loader2 size={13} className="animate-spin mr-1" />}
          Apply
        </Button>
        {currentBps !== null && (
          <Button size="sm" variant="ghost" onClick={handleClear} disabled={isPending}>Clear override</Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
