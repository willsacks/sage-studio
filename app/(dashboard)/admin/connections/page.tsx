import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plug, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { canManagePlatform } from "@/lib/access/platform-access";
import { getConnectedAppsOverview, getRecentApiAuditLog, type AdminConnectionRow, type AdminAuditLogRow } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Connected Apps — Admin" };

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/10 text-green-600",
  paused: "bg-amber-500/10 text-amber-600",
  revoked: "bg-red-500/10 text-red-600",
};

const RESULT_STYLES: Record<string, string> = {
  ok: "bg-green-500/10 text-green-600",
  denied: "bg-amber-500/10 text-amber-600",
  error: "bg-red-500/10 text-red-600",
  rate_limited: "bg-red-500/10 text-red-600",
};

function ConnectionRow({ row }: { row: AdminConnectionRow }) {
  const grantedModules = Object.entries(row.scopes).filter(([, level]) => level !== "none");
  return (
    <div className="py-3 flex items-center gap-3 flex-wrap">
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[row.status] ?? ""}`}>{row.status}</span>
      <span className="text-sm font-medium">{row.displayName}</span>
      <span className="text-xs text-[var(--muted-foreground)]">({row.clientName})</span>
      <span className="text-xs text-[var(--muted-foreground)]">owner: {row.userLabel}</span>
      <span className="text-xs text-[var(--muted-foreground)] ml-auto">
        {grantedModules.map(([m, lvl]) => `${m}:${lvl}`).join(", ") || "no access"}
      </span>
      <span className="text-xs text-[var(--muted-foreground)] w-full sm:w-auto">
        created {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
        {row.lastUsedAt && ` · last used ${formatDistanceToNow(new Date(row.lastUsedAt), { addSuffix: true })}`}
      </span>
    </div>
  );
}

function AuditLogRow({ row }: { row: AdminAuditLogRow }) {
  return (
    <div className="py-2.5 flex items-center gap-2 flex-wrap text-sm">
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${RESULT_STYLES[row.resultStatus] ?? ""}`}>{row.resultStatus}</span>
      <span className="font-medium">{row.operation}</span>
      <span className="text-xs text-[var(--muted-foreground)]">{row.channel}</span>
      <span className="text-xs text-[var(--muted-foreground)]">{row.userLabel}</span>
      {row.errorCode && <span className="text-xs text-red-500">{row.errorCode}</span>}
      <span className="text-xs text-[var(--muted-foreground)] ml-auto">
        {formatDistanceToNow(new Date(row.ts), { addSuffix: true })}
        {row.latencyMs != null && ` · ${row.latencyMs}ms`}
      </span>
    </div>
  );
}

export default async function AdminConnectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canManagePlatform(profile?.role)) redirect("/admin/users");

  const [connections, auditLog] = await Promise.all([getConnectedAppsOverview(), getRecentApiAuditLog(100)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug size={22} /> Connected AI Assistants
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Every user's connected assistants (PATs and OAuth connections) and what they've been doing, for security visibility across the whole platform.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">Connections ({connections.length})</h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] px-4">
          {connections.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">No connections yet.</p>
          ) : (
            connections.map((row) => <ConnectionRow key={row.id} row={row} />)
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
          <Activity size={14} /> Recent activity (last {auditLog.length})
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] px-4 max-h-[600px] overflow-y-auto">
          {auditLog.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">No activity yet.</p>
          ) : (
            auditLog.map((row) => <AuditLogRow key={row.id} row={row} />)
          )}
        </div>
      </div>
    </div>
  );
}
