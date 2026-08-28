"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getTaxSetAsideEstimate, setTaxReservePercentage } from "@/lib/actions/finance-tax-settings";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function TaxSetAsideCard({ entityId }: { entityId: string }) {
  const [estimate, setEstimate] = useState<Awaited<ReturnType<typeof getTaxSetAsideEstimate>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [percentage, setPercentage] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    const result = await getTaxSetAsideEstimate(entityId);
    setEstimate(result);
    setPercentage(String(result.reservePercentage));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  async function handleSave() {
    setSaving(true);
    await setTaxReservePercentage(entityId, Number(percentage));
    setSaving(false);
    setEditing(false);
    refresh();
  }

  if (loading || !estimate) {
    return <div className="rounded-xl border border-[var(--border)] p-4 flex justify-center"><Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }

  return (
    <div className="col-span-2 md:col-span-4 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted-foreground)]">
          Recommended tax set-aside ({estimate.reservePercentage}% of YTD net income) — estimate only, confirm with a CPA or tax professional
        </p>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input type="number" value={percentage} onChange={(e) => setPercentage(e.target.value)} className="h-7 w-16 text-xs" />
            <span className="text-xs">%</span>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>{saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}</Button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <Pencil size={12} />
          </button>
        )}
      </div>
      <p className="text-2xl font-semibold mt-1">{money(estimate.recommendedReserve)}</p>
      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Based on {money(estimate.netIncome)} net income since {estimate.startDate}</p>
    </div>
  );
}
