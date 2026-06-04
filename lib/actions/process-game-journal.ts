"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function requireAuth() {
  const supabase = (await createClient()) as AnyClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function saveJournal(learnings: string[], conclusionsActions: string[]) {
  const { supabase, user } = await requireAuth();
  await supabase.from("process_game_journal").upsert(
    { user_id: user.id, learnings, conclusions_actions: conclusionsActions, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  revalidatePath("/process-game");
}
