"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listRecentBroadcasts } from "@/lib/actions/newsletter";

type Broadcast = { id: string; name: string; subject: string | null; status: string; sent_at: string | null; created_at: string };

export function SentTab() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecentBroadcasts().then((result) => {
      if (result.error) setError(result.error);
      setBroadcasts(result.broadcasts as Broadcast[]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (broadcasts.length === 0) return <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">Nothing sent yet.</p>;

  return (
    <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
      {broadcasts.map((b) => (
        <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
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
        </div>
      ))}
    </div>
  );
}
