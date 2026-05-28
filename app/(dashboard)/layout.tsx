import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/Sidebar";
import { isProPlan } from "@/lib/plan-gates";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, tier_key, onboarding_done, role")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_done) redirect("/onboarding");

  const plan = isProPlan(profile?.tier_key ?? "", profile?.role) ? "pro" : "free";
  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex min-h-screen">
      <Sidebar displayName={profile?.display_name ?? null} plan={plan} isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
