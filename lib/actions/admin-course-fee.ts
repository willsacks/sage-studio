"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { canManagePlatform } from "@/lib/access/platform-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function requireManage(): Promise<AnyClient> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canManagePlatform(profile?.role)) throw new Error("Not authorized");
  return createAdminClient();
}

/** Course sales take no platform cut by default (Sage Studio makes money
 * on the Pro subscription instead — lib/stripe-connect.ts's
 * DEFAULT_COURSE_PLATFORM_FEE_BPS). This lets an admin override that per
 * creator, including to an explicit 0%, which is why the column itself
 * is nullable rather than defaulting to 0 — null means "no override". */
export async function setCoursePlatformFeeOverride(userId: string, percent: number | null) {
  const admin = await requireManage();
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
    return { error: "Enter a percent between 0 and 100" };
  }
  const bps = percent === null ? null : Math.round(percent * 100);

  const { error } = await admin.from("profiles").update({ course_platform_fee_bps: bps }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}
