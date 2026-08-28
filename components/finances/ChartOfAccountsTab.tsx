"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listChartOfAccounts, createChartAccount, setChartAccountActive } from "@/lib/actions/finance-accounts";
import type { FinanceEntity } from "./FinancesApp";

type Account = {
  id: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  account_subtype: string;
  is_active: boolean;
  is_default: boolean;
};

const TYPE_LABELS: Record<Account["account_type"], string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const TYPE_ORDER: Account["account_type"][] = ["asset", "liability", "equity", "income", "expense"];

export function ChartOfAccountsTab({ entity }: { entity: FinanceEntity }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["account_type"]>("expense");
  const [subtype, setSubtype] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listChartOfAccounts(entity.id);
    setAccounts((result.accounts ?? []) as Account[]);
    setLoading(false);
  }, [entity.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate() {
    if (!name.trim() || !subtype.trim()) {
      setError("Give it a name and category");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await createChartAccount({ entityId: entity.id, name, accountType: type, accountSubtype: subtype });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setSubtype("");
    setShowForm(false);
    refresh();
  }

  async function toggleActive(account: Account) {
    await setChartAccountActive(account.id, entity.id, !account.is_active);
    refresh();
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          Advanced: most people never need to touch this — it's seeded automatically and updated behind the scenes when you categorize transactions.
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} className="mr-1" /> New account
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vinyl Pressing" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as Account["account_type"])} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Category</label>
              <Input value={subtype} onChange={(e) => setSubtype(e.target.value)} placeholder="e.g. Operating Expense" className="h-9 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 size={13} className="animate-spin mr-1" />} Create account
          </Button>
        </div>
      )}

      {TYPE_ORDER.map((type) => {
        const group = accounts.filter((a) => a.account_type === type);
        if (group.length === 0) return null;
        return (
          <div key={type}>
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1.5">{TYPE_LABELS[type]}</p>
            <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
              {group.map((a) => (
                <div key={a.id} className={`flex items-center justify-between px-4 py-2 ${!a.is_active ? "opacity-50" : ""}`}>
                  <div>
                    <p className="text-sm">{a.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{a.account_subtype}</p>
                  </div>
                  {!a.is_default && (
                    <button onClick={() => toggleActive(a)} className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      {a.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
