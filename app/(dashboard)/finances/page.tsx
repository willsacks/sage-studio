import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FinancesApp } from "@/components/finances/FinancesApp";

export const metadata: Metadata = { title: "Finances" };

export default async function FinancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entities } = await supabase
    .from("finance_entities")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

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

      <FinancesApp initialEntities={entities ?? []} />
    </div>
  );
}
