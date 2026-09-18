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

export async function updateAccountProfile({ displayName, username }: { displayName: string; username: string }) {
  const { supabase, user } = await requireAuth();

  const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!trimmedUsername) return { error: "Username can't be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ display_name: displayName.trim() || null, username: trimmedUsername })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "That username is already taken" };
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Supabase Auth's own updateUser({ email }) — this doesn't take effect
 * immediately. It sends a confirmation link to the new address (and, if
 * "Secure email change" is on for this project, one to the old address
 * too) and only swaps the account's email once that's clicked, so the
 * caller should surface that rather than assuming the change is live. */
export async function updateAccountEmail(newEmail: string) {
  const { supabase } = await requireAuth();
  const trimmed = newEmail.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email address" };

  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) return { error: error.message };
  return { success: true };
}
