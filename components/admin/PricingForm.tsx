"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePlatformPricing } from "@/lib/actions/admin-pricing";

export function PricingForm({ initialPriceCents }: { initialPriceCents: number }) {
  const [price, setPrice] = useState((initialPriceCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePlatformPricing(parseFloat(price));
      if (result?.error) { setError(result.error); return; }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-2 max-w-xs">
      <Label htmlFor="pro-price">Pro plan price (per month)</Label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--muted-foreground)]">$</span>
        <Input id="pro-price" type="number" step="0.01" min="0.01" value={price} onChange={(e) => { setPrice(e.target.value); setSaved(false); }} />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Only affects new checkouts — existing subscribers keep their current price. Stripe prices can't be edited in place, so this creates a new price and archives the old one.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Updated — new signups will see the new price.</p>}
      <Button size="sm" onClick={handleSave} disabled={isPending}>
        {isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
        Update price
      </Button>
    </div>
  );
}
