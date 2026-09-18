"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listRecentBroadcasts, getBroadcast } from "@/lib/actions/newsletter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Broadcast = { id: string; name: string; subject: string | null; status: string; sent_at: string | null; created_at: string };
type BroadcastDetail = { id: string; subject: string | null; html: string | null; text: string | null };

export function SentTab() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BroadcastDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    listRecentBroadcasts().then((result) => {
      if (result.error) setError(result.error);
      setBroadcasts(result.broadcasts as Broadcast[]);
      setLoading(false);
    });
  }, []);

  function handleOpen(b: Broadcast) {
    setOpenId(b.id);
    setDetail(null);
    setDetailError(null);
    getBroadcast(b.id).then((result) => {
      if ("error" in result && result.error) { setDetailError(result.error); return; }
      setDetail(result.broadcast as unknown as BroadcastDetail);
    });
  }

  const openBroadcast = broadcasts.find((b) => b.id === openId);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (broadcasts.length === 0) return <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">Nothing sent yet.</p>;

  return (
    <>
      <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {broadcasts.map((b) => (
          <button
            key={b.id}
            onClick={() => handleOpen(b)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--accent)] transition-colors"
          >
            <div>
              <p className="text-sm font-medium">{b.subject ?? b.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {b.sent_at ? new Date(b.sent_at).toLocaleString() : "Not sent"}
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              b.status === "sent" ? "bg-green-500/10 text-green-600" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}>
              {b.status}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openBroadcast?.subject ?? openBroadcast?.name}</DialogTitle>
          </DialogHeader>
          {detailError ? (
            <p className="text-sm text-red-500">{detailError}</p>
          ) : !detail ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
          ) : detail.html ? (
            <div className="rounded-lg border border-[var(--border)] p-4" dangerouslySetInnerHTML={{ __html: detail.html }} />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{detail.text}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
