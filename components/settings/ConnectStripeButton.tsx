"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startStripeConnectOnboarding } from "@/lib/actions/stripe-connect";

/** Connect onboarding is fully Stripe-hosted — unlike Plaid Link, there's
 * no JS SDK popup to drive, just a full-page redirect out and a return
 * URL (app/(dashboard)/settings/stripe-connect-return) to come back to. */
export function ConnectStripeButton({ label = "Connect Stripe to get paid" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    const result = await startStripeConnectOnboarding();
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    window.location.href = result.url!;
  }

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={start} disabled={loading}>
        {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CreditCard size={14} className="mr-1.5" />}
        {label}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
