import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canManagePlatform } from "@/lib/access/platform-access";
import { getPlatformPricing } from "@/lib/actions/admin-pricing";
import { PricingForm } from "@/components/admin/PricingForm";

export const metadata: Metadata = { title: "Pricing — Admin" };

export default async function AdminPricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canManagePlatform(profile?.role)) redirect("/admin/users");

  const pricing = await getPlatformPricing();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign size={22} /> Pricing
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Plan pricing for new signups. To grant a specific user a discount, open their account under Users.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Plans</h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <PricingForm initialPriceCents={pricing.priceCents} />
        </div>
      </section>
    </div>
  );
}
