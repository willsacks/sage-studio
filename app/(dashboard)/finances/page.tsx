import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FinancesApp } from "@/components/finances/FinancesApp";

export const metadata: Metadata = { title: "Finances" };

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { entity: requestedEntityId } = await searchParams;

  // A user sees entities they own AND entities they've been invited to as a
  // collaborator (e.g. a bookkeeper) — not just what they own.
  const [{ data: ownedEntities }, { data: memberships }] = await Promise.all([
    supabase.from("finance_entities").select("*").eq("owner_id", user.id),
    supabase.from("finance_entity_members").select("entity_id").eq("user_id", user.id).eq("status", "accepted"),
  ]);
  const memberEntityIds = (memberships ?? []).map((m) => m.entity_id);
  const { data: memberEntities } = memberEntityIds.length
    ? await supabase.from("finance_entities").select("*").in("id", memberEntityIds)
    : { data: [] };
  const entities = [...(ownedEntities ?? []), ...(memberEntities ?? [])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((e) => ({ ...e, is_owner: e.owner_id === user.id }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet size={22} /> Finances
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Track project profitability, connect your bank accounts, and keep your personal and business books separate.
        </p>
      </div>

      <FinancesApp initialEntities={entities ?? []} initialEntityId={requestedEntityId} />
    </div>
  );
}
