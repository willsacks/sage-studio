"use client";

import { useState } from "react";
import { Sparkles, Landmark, FileSpreadsheet, Loader2, X } from "lucide-react";
import { CreateEntityForm } from "./CreateEntityForm";
import { WaveImportWizard } from "./WaveImportWizard";
import { buildQboAuthUrl } from "@/lib/actions/finance-qbo";
import type { FinanceEntity } from "./FinancesApp";

type Mode = "choosing" | "fresh" | "wave";

export function AddEntityChooser({ onClose, onCreated }: { onClose: () => void; onCreated: (entity: FinanceEntity) => void }) {
  const [mode, setMode] = useState<Mode>("choosing");
  const [connectingQbo, setConnectingQbo] = useState(false);
  const [qboError, setQboError] = useState<string | null>(null);

  async function handleQuickBooks() {
    const name = window.prompt("What should we call these books? (e.g. your company name)");
    if (!name?.trim()) return;
    setConnectingQbo(true);
    setQboError(null);
    const result = await buildQboAuthUrl({ intendedEntityName: name.trim(), entityType: "business" });
    setConnectingQbo(false);
    if (!result.authUrl) {
      setQboError(result.error ?? "Something went wrong");
      return;
    }
    window.location.href = result.authUrl;
  }

  if (mode === "fresh") {
    return (
      <div className="relative">
        <button onClick={onClose} className="absolute -top-2 -right-2 p-1 rounded-full bg-[var(--background)] border border-[var(--border)]">
          <X size={12} />
        </button>
        <CreateEntityForm onCreated={onCreated} />
      </div>
    );
  }

  if (mode === "wave") {
    return (
      <WaveImportWizard
        onClose={onClose}
        onImported={(entityId) => { window.location.href = `/finances?entity=${entityId}`; }}
      />
    );
  }

  return (
    <div className="relative rounded-xl border border-[var(--border)] p-4 space-y-2 max-w-sm">
      <button onClick={onClose} className="absolute -top-2 -right-2 p-1 rounded-full bg-[var(--background)] border border-[var(--border)]">
        <X size={12} />
      </button>
      <p className="text-sm font-medium mb-1">Add a set of books</p>

      <button
        onClick={() => setMode("fresh")}
        className="w-full flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--accent)] transition-colors text-left"
      >
        <Sparkles size={16} className="text-[var(--muted-foreground)]" />
        <span>Start fresh</span>
      </button>

      <button
        onClick={handleQuickBooks}
        disabled={connectingQbo}
        className="w-full flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--accent)] transition-colors text-left disabled:opacity-50"
      >
        {connectingQbo ? <Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" /> : <Landmark size={16} className="text-[var(--muted-foreground)]" />}
        <span>Import from QuickBooks</span>
      </button>

      <button
        onClick={() => setMode("wave")}
        className="w-full flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-[var(--accent)] transition-colors text-left"
      >
        <FileSpreadsheet size={16} className="text-[var(--muted-foreground)]" />
        <span>Import from Wave</span>
      </button>

      {qboError && <p className="text-xs text-red-500">{qboError}</p>}
    </div>
  );
}
