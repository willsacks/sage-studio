"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/access/platform-access";

const VALID_ROLES = ["member", "admin", "manager", "customer_success"] as const;

/** Granting/revoking a platform role is a privilege-escalation action —
 * restricted to real admins, not managers (see platform-access.ts's note
 * that managers get everything non-destructive; changing who else has
 * admin/manager powers is the one thing that doesn't fit that). */
export async function setUserRole(userId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isPlatformAdmin(profile?.role)) return { error: "Not authorized" };

  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) return { error: "Invalid role" };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role: role as "member" | "admin" | "manager" | "customer_success" }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { success: true };
}
