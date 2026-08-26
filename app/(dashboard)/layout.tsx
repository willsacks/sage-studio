import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/Sidebar";
import { MobileNav } from "@/components/nav/MobileNav";
import { PageContainer } from "@/components/nav/PageContainer";
import { isProPlan } from "@/lib/plan-gates";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("display_name, tier_key, onboarding_done, role, hidden_nav_items")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_done) redirect("/onboarding");

  const plan = isProPlan(profile?.tier_key ?? "", profile?.role) ? "pro" : "free";
  const isAdmin = profile?.role === "admin";
  const hiddenNavItems = (profile?.hidden_nav_items as string[] | null) ?? [];

  return (
    <div className="flex min-h-screen">
      <Sidebar displayName={profile?.display_name ?? null} plan={plan} isAdmin={isAdmin} hiddenNavItems={hiddenNavItems} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav displayName={profile?.display_name ?? null} plan={plan} isAdmin={isAdmin} hiddenNavItems={hiddenNavItems} />
        <main className="flex-1 overflow-y-auto">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
