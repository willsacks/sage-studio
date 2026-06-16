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

export interface CategorySelection {
  category: string | null;
}

export async function startTimer(description: string, sel?: CategorySelection) {
  const { supabase, user } = await requireAuth();
  const now = new Date().toISOString();

  // Stop any currently running entry first
  const { data: running } = await supabase
    .from("time_entries")
    .select("id, started_at")
    .eq("user_id", user.id)
    .is("stopped_at", null)
    .maybeSingle();

  if (running) {
    const durationSeconds = Math.floor(
      (Date.now() - new Date(running.started_at).getTime()) / 1000
    );
    await supabase
      .from("time_entries")
      .update({ stopped_at: now, duration_seconds: durationSeconds })
      .eq("id", running.id);
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      user_id: user.id,
      description: description.trim(),
      started_at: now,
      category: sel?.category ?? null,
    })
    .select("id, started_at, description, category")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { entry: data };
}

export async function stopTimer(entryId: string) {
  const { supabase, user } = await requireAuth();
  const now = new Date().toISOString();

  const { data: entry } = await supabase
    .from("time_entries")
    .select("started_at")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .single();

  if (!entry) return { error: "Entry not found" };

  const durationSeconds = Math.floor(
    (Date.now() - new Date(entry.started_at).getTime()) / 1000
  );

  await supabase
    .from("time_entries")
    .update({ stopped_at: now, duration_seconds: durationSeconds })
    .eq("id", entryId)
    .eq("user_id", user.id);

  revalidatePath("/tasks");
  return { success: true };
}

export async function updateTimerDescription(entryId: string, description: string) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("time_entries")
    .update({ description })
    .eq("id", entryId)
    .eq("user_id", user.id)
    .is("stopped_at", null);
}

export async function updateTimerCategory(entryId: string, sel: CategorySelection) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("time_entries")
    .update({ category: sel.category })
    .eq("id", entryId)
    .eq("user_id", user.id)
    .is("stopped_at", null);
}

export async function updateTimeEntry(
  entryId: string,
  description: string,
  startedAt: string,
  stoppedAt: string,
  sel?: CategorySelection
) {
  const { supabase, user } = await requireAuth();

  const start = new Date(startedAt);
  const stop = new Date(stoppedAt);
  if (isNaN(start.getTime()) || isNaN(stop.getTime()) || stop <= start) {
    return { error: "Invalid time range" };
  }

  const durationSeconds = Math.floor((stop.getTime() - start.getTime()) / 1000);

  const { data: updated, error } = await supabase
    .from("time_entries")
    .update({
      description: description.trim(),
      started_at: start.toISOString(),
      stopped_at: stop.toISOString(),
      duration_seconds: durationSeconds,
      category: sel?.category ?? null,
    })
    .eq("id", entryId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!updated) return { error: "Entry not found or could not be updated" };
  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteTimeEntry(entryId: string) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("time_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);
  revalidatePath("/tasks");
  return { success: true };
}
