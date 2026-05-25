"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function signInWithMagicLink(email: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signInWithGoogle(): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data: { url: data.url } };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

export async function completeOnboarding(displayName: string, username: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();
  if (existing) return { success: false, error: "That username is already taken" };

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
    username,
    onboarding_done: true,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
