"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NAV } from "@/components/nav/Sidebar";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Which of NAV's items (Sidebar.tsx) this user has chosen to hide from
 * their own sidebar/mobile nav — a purely cosmetic per-user preference,
 * not a permission. SETTINGS_NAV (Billing, Settings) is intentionally not
 * customizable, so a user can never hide their way out of account
 * management. */
export async function setHiddenNavItems(hiddenItems: string[]) {
  const { supabase, user } = await requireAuth();

  const validHrefs = new Set(NAV.map((item) => item.href));
  const filtered = hiddenItems.filter((href) => validHrefs.has(href));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ hidden_nav_items: filtered })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}
