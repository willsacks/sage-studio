"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const FILE_INPUT_CLASS =
  "w-full text-sm text-[var(--muted-foreground)] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--card)] file:text-sm file:font-medium file:text-[var(--foreground)] hover:file:bg-[var(--accent)] file:cursor-pointer file:transition-colors";

type Step = "name" | "files" | "importing" | "done";

/** A guided, multi-file import — separate from CsvImportDialog.tsx, which
 * stays focused on its existing job (importing bank transactions into an
 * already-existing entity). This always creates a brand-new entity, so
 * every step is a distinct component rather than a retrofit of that one. */
export function WaveImportWizard({ onClose, onImported }: { onClose: () => void; onImported: (entityId: string) => void }) {
  const [step, setStep] = useState<Step>("name");
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<"personal" | "business">("business");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const accountsFileRef = useRef<HTMLInputElement>(null);
  const customersFileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    setStep("importing");
    setError(null);

    const formData = new FormData();
    formData.append("entityName", entityName.trim());
    formData.append("entityType", entityType);
    if (accountsFileRef.current?.files?.[0]) formData.append("accountsFile", accountsFileRef.current.files[0]);
    if (customersFileRef.current?.files?.[0]) formData.append("customersFile", customersFileRef.current.files[0]);

    try {
      const response = await fetch("/api/finance/wave-import", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.error) {
        setError(data?.error ?? `Import failed (${response.status})`);
        setStep("files");
        return;
      }
      setWarnings(data.warnings ?? []);
      setStep("done");
      onImported(data.entityId);
    } catch {
      setError("Import failed — check your connection and try again");
      setStep("files");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md space-y-4">
        <DialogHeader>
          <DialogTitle>Import from Wave</DialogTitle>
          <DialogDescription>
            This creates a brand-new set of books from your Wave data exports — it never merges into an existing entity.
          </DialogDescription>
        </DialogHeader>

        {step === "name" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">What should we call these books?</label>
              <Input value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="Acme LLC" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Type</label>
              <select value={entityType} onChange={(e) => setEntityType(e.target.value as "personal" | "business")} className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm">
                <option value="business">Business</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <Button size="sm" onClick={() => setStep("files")} disabled={!entityName.trim()}>
              Continue
            </Button>
          </div>
        )}

        {step === "files" && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Both files are optional — skip anything you don't have. Export these from Wave's Reports section.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Chart of Accounts CSV (optional)</label>
              <input ref={accountsFileRef} type="file" accept=".csv" className={FILE_INPUT_CLASS} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Customers CSV (optional)</label>
              <input ref={customersFileRef} type="file" accept=".csv" className={FILE_INPUT_CLASS} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep("name")}>Back</Button>
              <Button size="sm" onClick={handleImport}>
                <Upload size={13} className="mr-1" /> Create entity and import
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Importing your data...</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3">
            <p className="text-sm text-green-600">Your new entity is ready.</p>
            {warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">A few rows needed attention:</p>
                <ul className="text-xs text-[var(--muted-foreground)] list-disc pl-4 space-y-0.5">
                  {warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
