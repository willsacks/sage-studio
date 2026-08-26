"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listAllNewsletterDomains,
  getNewsletterDomain,
  addNewsletterDomain,
  verifyNewsletterDomain,
  removeNewsletterDomain,
} from "@/lib/actions/newsletter";

type DnsRecord = { record: string; type: string; name: string; value: string; ttl: string; status: string };
type Domain = { id: string; name: string; status: string };

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-green-500/10 text-green-600",
  pending: "bg-amber-500/10 text-amber-600",
  failed: "bg-red-500/10 text-red-600",
};

export function DomainsTab() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordsById, setRecordsById] = useState<Record<string, DnsRecord[]>>({});
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const result = await listAllNewsletterDomains();
    if (result.error) setError(result.error);
    setDomains(result.domains as Domain[]);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleAdd() {
    if (!newDomain.trim()) return;
    setAdding(true);
    setError(null);
    const result = await addNewsletterDomain(newDomain);
    setAdding(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewDomain("");
    if (result.domain) {
      setExpandedId(result.domain.id);
      setRecordsById((prev) => ({ ...prev, [result.domain!.id]: result.domain!.records as DnsRecord[] }));
    }
    refresh();
  }

  async function toggleExpand(domainId: string) {
    if (expandedId === domainId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(domainId);
    if (!recordsById[domainId]) {
      setLoadingRecords(true);
      const result = await getNewsletterDomain(domainId);
      if (result.domain) {
        setRecordsById((prev) => ({ ...prev, [domainId]: result.domain!.records as DnsRecord[] }));
      } else if (result.error) {
        setError(result.error);
      }
      setLoadingRecords(false);
    }
  }

  async function handleVerify(domainId: string) {
    setVerifyingId(domainId);
    setError(null);
    const result = await verifyNewsletterDomain(domainId);
    setVerifyingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.domain) {
      setRecordsById((prev) => ({ ...prev, [domainId]: result.domain!.records as DnsRecord[] }));
    }
    refresh();
  }

  async function handleRemove(domainId: string) {
    const result = await removeNewsletterDomain(domainId);
    if (result.error) setError(result.error);
    else refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        Add a domain you own to send from it (e.g. <code>news@yourdomain.com</code>). You&apos;ll need access to your domain&apos;s DNS settings to add the records Resend gives you.
      </p>

      <div className="flex gap-2">
        <Input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="yourdomain.com"
          className="h-9 text-sm max-w-xs"
        />
        <Button size="sm" onClick={handleAdd} disabled={adding || !newDomain.trim()}>
          {adding ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
          Add domain
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
      ) : domains.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No domains yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {domains.map((d) => {
            const expanded = expandedId === d.id;
            return (
              <div key={d.id}>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{d.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[d.status] ?? "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
                      {d.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.status !== "verified" && (
                      <Button size="sm" variant="outline" onClick={() => handleVerify(d.id)} disabled={verifyingId === d.id} className="h-7 text-xs">
                        {verifyingId === d.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        <span className="ml-1">Check</span>
                      </Button>
                    )}
                    <button
                      onClick={() => toggleExpand(d.id)}
                      className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => handleRemove(d.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="px-4 pb-3 space-y-2 bg-[var(--muted)]/30">
                    <p className="text-xs text-[var(--muted-foreground)] pt-2">
                      Add these DNS records at your domain registrar, then click Check:
                    </p>
                    {loadingRecords && !recordsById[d.id] ? (
                      <div className="flex justify-center py-3"><Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" /></div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[var(--muted-foreground)]">
                              <th className="pr-3 py-1">Type</th>
                              <th className="pr-3 py-1">Name</th>
                              <th className="pr-3 py-1">Value</th>
                              <th className="py-1">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(recordsById[d.id] ?? []).map((r, i) => (
                              <tr key={i} className="border-t border-[var(--border)]">
                                <td className="pr-3 py-1.5 font-mono">{r.type}</td>
                                <td className="pr-3 py-1.5 font-mono break-all">{r.name}</td>
                                <td className="pr-3 py-1.5 font-mono break-all">{r.value}</td>
                                <td className="py-1.5">{r.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
