"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setCustomDomain, removeCustomDomain, recheckDomainStatus } from "@/lib/actions/sites";

type Props = {
  siteId: string;
  currentDomain: string | null;
  isVerified: boolean;
};

export function CustomDomainForm({ siteId, currentDomain, isVerified }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [domain, setDomain] = useState(currentDomain ?? "");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ verified: boolean; status: string } | null>(null);

  const hasDomain = !!currentDomain;
  const showDnsInstructions = hasDomain && !isVerified;

  function handleSave() {
    if (!domain.trim()) return;
    setError(null);
    setWarning(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setCustomDomain(siteId, domain.trim());
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        if (result.warning) setWarning(result.warning);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  function handleRemove() {
    if (!confirm(`Remove ${currentDomain}? This will take it offline.`)) return;
    startTransition(async () => {
      await removeCustomDomain(siteId);
      setDomain("");
      setCheckResult(null);
      router.refresh();
    });
  }

  async function handleCheck() {
    setChecking(true);
    const result = await recheckDomainStatus(siteId);
    setCheckResult(result.error ? null : { verified: result.verified ?? false, status: result.status ?? "unknown" });
    setChecking(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="custom-domain">Custom Domain</Label>
        <p className="text-xs text-[var(--muted-foreground)]">
          Point your domain to this site. Enter the domain without https:// (e.g. <code className="text-[var(--foreground)]">willsage.com</code> or <code className="text-[var(--foreground)]">www.willsage.com</code>).
        </p>
        <div className="flex gap-2">
          <Input
            id="custom-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourdomain.com"
            className="flex-1 text-sm font-mono"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
          <Button onClick={handleSave} disabled={isPending || !domain.trim() || domain === currentDomain} size="sm">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : saved ? "Saved ✓" : "Save"}
          </Button>
          {hasDomain && (
            <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isPending} className="text-[var(--muted-foreground)] hover:text-red-500">
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {warning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          {warning}
        </div>
      )}

      {/* Verification status */}
      {hasDomain && (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${
          isVerified
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-[var(--muted)]/40 border-[var(--border)]"
        }`}>
          <div className="flex items-center gap-2">
            {isVerified ? (
              <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">
                {isVerified ? `${currentDomain} is live` : "Awaiting DNS propagation"}
              </p>
              {checkResult && !isVerified && (
                <p className="text-xs text-[var(--muted-foreground)]">Status: {checkResult.status}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isVerified && (
              <a href={`https://${currentDomain}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm"><ExternalLink size={13} /></Button>
              </a>
            )}
            {!isVerified && (
              <Button variant="outline" size="sm" onClick={handleCheck} disabled={checking}>
                {checking ? <Loader2 size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                Check
              </Button>
            )}
          </div>
        </div>
      )}

      {/* DNS instructions */}
      {showDnsInstructions && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">DNS Setup Instructions</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Add these records in your domain registrar's DNS settings. Changes can take up to 48 hours to propagate.
          </p>

          <div className="space-y-2">
            {/* Apex domain A record */}
            <div className="rounded-lg bg-[var(--muted)]/40 p-3 font-mono text-xs space-y-1.5">
              <p className="text-[var(--muted-foreground)] font-sans text-[10px] uppercase tracking-wide font-semibold">For apex domain ({currentDomain?.replace(/^www\./, "")})</p>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-[var(--muted-foreground)]">Type</span><br /><span className="text-[var(--foreground)]">A</span></div>
                <div><span className="text-[var(--muted-foreground)]">Name</span><br /><span className="text-[var(--foreground)]">@</span></div>
                <div><span className="text-[var(--muted-foreground)]">Value</span><br /><span className="text-[var(--primary)]">76.76.21.21</span></div>
              </div>
            </div>

            {/* www CNAME */}
            <div className="rounded-lg bg-[var(--muted)]/40 p-3 font-mono text-xs space-y-1.5">
              <p className="text-[var(--muted-foreground)] font-sans text-[10px] uppercase tracking-wide font-semibold">For www subdomain</p>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-[var(--muted-foreground)]">Type</span><br /><span className="text-[var(--foreground)]">CNAME</span></div>
                <div><span className="text-[var(--muted-foreground)]">Name</span><br /><span className="text-[var(--foreground)]">www</span></div>
                <div><span className="text-[var(--muted-foreground)]">Value</span><br /><span className="text-[var(--primary)]">cname.vercel-dns.com</span></div>
              </div>
            </div>
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            After adding records, click <strong>Check</strong> above to verify. SSL is auto-provisioned once DNS propagates.
          </p>
        </div>
      )}
    </div>
  );
}
