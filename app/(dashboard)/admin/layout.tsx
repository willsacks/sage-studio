import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformStaff, canManagePlatform } from "@/lib/access/platform-access";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isPlatformStaff(profile?.role)) redirect("/my-site");

  const canManage = canManagePlatform(profile?.role);

  return (
    <div className="space-y-6">
      <AdminNav canManage={canManage} />
      {children}
    </div>
  );
}
