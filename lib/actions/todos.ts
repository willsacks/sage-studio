"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function createTodo(title: string, dueDate: string | null, position: number) {
  const { supabase, user } = await requireAuth();
  await supabase.from("todos").insert({ user_id: user.id, title, due_date: dueDate, position });
  revalidatePath("/todos");
}

export async function toggleTodo(id: string, completed: boolean) {
  const { supabase, user } = await requireAuth();
  await supabase.from("todos").update({ completed }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/todos");
}

export async function deleteTodo(id: string) {
  const { supabase, user } = await requireAuth();
  await supabase.from("todos").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/todos");
}

export async function moveTodo(id: string, dueDate: string | null, position: number) {
  const { supabase, user } = await requireAuth();
  await supabase.from("todos").update({ due_date: dueDate, position }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/todos");
}
