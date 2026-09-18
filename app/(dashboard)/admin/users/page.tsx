import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canViewUserAccounts } from "@/lib/access/platform-access";
import { getAllUsers } from "@/lib/queries/admin";
import { UsersTable } from "@/components/admin/UsersTable";

export const metadata: Metadata = { title: "Users — Admin" };

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canViewUserAccounts(profile?.role)) redirect("/my-site");

  const users = await getAllUsers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users size={22} /> Users
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Look up an account — click a row to see their sites, courses, and plan.
        </p>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
