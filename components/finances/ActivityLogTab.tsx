"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { listAuditLog, type AuditLogEntry } from "@/lib/actions/finance-audit";
import type { FinanceEntity } from "./FinancesApp";

const ACTION_LABELS: Record<string, string> = {
  "transaction.created": "Created a transaction",
  "transaction.categorized": "Categorized a transaction",
  "transaction.excluded": "Excluded a transaction",
  "transaction.deleted": "Deleted a transaction",
  "journal_entry.created": "Posted a journal entry",
  "journal_entry.deleted": "Deleted a journal entry",
  "account.created": "Created an account",
  "account.renamed": "Renamed an account",
  "account.archived": "Archived an account",
  "account.reactivated": "Reactivated an account",
  "books.closed": "Closed the books",
  "books.reopened": "Reopened the books",
  "bill.created": "Created a bill",
  "bill.voided": "Voided a bill",
  "bill.payment_recorded": "Recorded a bill payment",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Read-only history of who created/edited/deleted what in this entity's
 * ledger — the answer to "why did this change" for an owner reviewing a
 * bookkeeper's work, or a bookkeeper checking their own trail. Logged from
 * the mutation choke points in lib/actions/finance-{transactions,journal,
 * accounts,close}.ts via lib/finance/audit.ts, not reconstructed after the
 * fact — there's no way to backfill history for actions taken before this
 * shipped. */
export function ActivityLogTab({ entity }: { entity: FinanceEntity }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listAuditLog(entity.id).then((r) => {
      setEntries(r.entries ?? []);
      setLoading(false);
    });
  }, [entity.id]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  if (entries.length === 0) return <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No activity recorded yet.</p>;

  return (
    <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
      {entries.map((e) => {
        const expanded = expandedId === e.id;
        return (
          <div key={e.id} className="px-4 py-2.5">
            <button
              onClick={() => setExpandedId(expanded ? null : e.id)}
              className="flex items-center justify-between w-full text-left gap-3"
            >
              <div className="min-w-0 flex items-center gap-1.5">
                {e.diff ? (expanded ? <ChevronDown size={13} className="flex-shrink-0 text-[var(--muted-foreground)]" /> : <ChevronRight size={13} className="flex-shrink-0 text-[var(--muted-foreground)]" />) : <span className="w-[13px]" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ACTION_LABELS[e.action] ?? e.action}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{e.actorName} · {formatDate(e.createdAt)}</p>
                </div>
              </div>
            </button>
            {expanded && e.diff && (
              <pre className="mt-2 ml-[19px] text-xs bg-[var(--muted)] rounded-lg p-2 overflow-x-auto text-[var(--muted-foreground)]">
                {JSON.stringify(e.diff, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
