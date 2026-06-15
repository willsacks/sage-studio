"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";

export async function getTodos(): Promise<Tables<"todos">[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", user.id)
    .order("position", { ascending: true });
  return data ?? [];
}
