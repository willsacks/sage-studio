"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createClientRecord(name: string) {
  const { supabase, user } = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: user.id, name: trimmed })
    .select("id, name, created_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { client: data };
}

export async function renameClient(clientId: string, name: string) {
  const { supabase, user } = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { error } = await supabase
    .from("clients")
    .update({ name: trimmed })
    .eq("id", clientId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteClient(clientId: string) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", user.id);
  revalidatePath("/tasks");
  return { success: true };
}
