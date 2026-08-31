"use server";

import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export type AuditLogEntry = {
  id: string;
  action: string;
  targetTable: string;
  targetId: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
  actorName: string;
};

export async function listAuditLog(entityId: string, limit = 100) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  // finance_audit_log isn't in the generated Database type yet — same
  // convention as the finance_ai_categorize_runs table (cast to any).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("finance_audit_log")
    .select("id, action, target_table, target_id, diff, created_at, profiles(display_name, username)")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { error: error.message, entries: [] as AuditLogEntry[] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: AuditLogEntry[] = ((data ?? []) as any[]).map((r) => {
    const actor = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id as string,
      action: r.action as string,
      targetTable: r.target_table as string,
      targetId: r.target_id as string | null,
      diff: r.diff as Record<string, unknown> | null,
      createdAt: r.created_at as string,
      actorName: (actor?.display_name as string | undefined) || (actor?.username as string | undefined) || "Unknown",
    };
  });
  return { entries };
}
