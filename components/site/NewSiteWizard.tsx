"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteStyleSelector } from "./SiteStyleSelector";
import { createSiteWithStyle } from "@/lib/actions/sites";
import { DEFAULT_STYLE_KEY } from "@/lib/styles";

export function NewSiteWizard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [styleKey, setStyleKey] = useState(DEFAULT_STYLE_KEY);
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createSiteWithStyle(name, styleKey);
      if (result.error) {
        setError(result.error);
      } else if (result.siteId) {
        router.refresh(); // clear stale /my-site list from router cache
        router.push(`/my-site/${result.siteId}`);
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 text-sm font-medium ${step >= 1 ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>1</div>
          Name your site
        </div>
        <div className="flex-1 h-px bg-[var(--border)]" />
        <div className={`flex items-center gap-2 text-sm font-medium ${step >= 2 ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>2</div>
          Choose your aesthetic
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6 max-w-md">
          <div>
            <h2 className="text-xl font-semibold">What is this site for?</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Give it a name that reflects this facet of your work.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-name">Site name</Label>
            <Input
              id="site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Will Sage Music, Jane Doe Studio"
              className="text-base h-11"
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) setStep(2); }}
              autoFocus
            />
            <p className="text-xs text-[var(--muted-foreground)]">You can change this anytime in Settings.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!name.trim()} size="lg">
              Next <ArrowRight size={15} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">Choose your aesthetic</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Pick the vibe for <strong>{name}</strong>. You can change this anytime.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft size={14} className="mr-1" /> Back
            </Button>
          </div>

          <SiteStyleSelector selectedKey={styleKey} onSelect={setStyleKey} />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)]">You can add pages after creating.</p>
            <Button onClick={handleCreate} disabled={isPending} size="lg">
              {isPending ? <Loader2 size={15} className="animate-spin mr-2" /> : <Globe size={15} className="mr-2" />}
              Create Website
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
