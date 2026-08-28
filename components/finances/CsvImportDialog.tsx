"use client";

import { useRef, useState } from "react";
import { Loader2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Account = { id: string; name: string; account_subtype: string };

const MONEY_SUBTYPES = ["Cash and Bank", "Credit Card"];

export function CsvImportDialog({
  entityId,
  accounts,
  onClose,
  onImported,
}: {
  entityId: string;
  accounts: Account[];
  onClose: () => void;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const moneyAccounts = accounts.filter((a) => MONEY_SUBTYPES.includes(a.account_subtype));

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file");
      return;
    }
    if (!moneyAccountId) {
      setError("Choose which account these transactions belong to");
      return;
    }

    setImporting(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityId", entityId);
    formData.append("moneyAccountId", moneyAccountId);

    const response = await fetch("/api/finance/import-transactions", { method: "POST", body: formData });
    const data = await response.json();
    setImporting(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    setResult({ imported: data.imported, skipped: data.skipped });
    onImported();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] p-5 w-full max-w-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-sm">Import transactions from CSV</h3>
          <button onClick={onClose} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          Expects a header row with Date, Description, and either an Amount column (positive = money in) or separate Debit/Credit columns.
        </p>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Which account are these for?</label>
          <select value={moneyAccountId} onChange={(e) => setMoneyAccountId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="">Choose...</option>
            {moneyAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <input ref={fileInputRef} type="file" accept=".csv" className="text-sm" />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {result && (
          <p className="text-sm text-green-600">
            Imported {result.imported} transaction{result.imported === 1 ? "" : "s"}
            {result.skipped > 0 ? ` (${result.skipped} rows skipped — couldn't parse)` : ""}. They'll show up as uncategorized.
          </p>
        )}

        <Button size="sm" onClick={handleImport} disabled={importing}>
          {importing ? <Loader2 size={13} className="animate-spin mr-1" /> : <Upload size={13} className="mr-1" />}
          Import
        </Button>
      </div>
    </div>
  );
}
