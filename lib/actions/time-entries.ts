"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleTodo } from "./todos";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export interface CategorySelection {
  category: string | null;
  client_id: string | null;
}

export async function startTimer(description: string, sel?: CategorySelection, todoId?: string | null) {
  const { supabase } = await requireAuth();

  // Closing any currently-running entry and inserting the new one both
  // happen inside start_time_entry (scripts/add-time-entry-rpc-functions.ts)
  // as a single atomic round trip, instead of a SELECT -> UPDATE -> INSERT
  // chain — that sequential chain was the main source of the reported
  // "long delay when starting a time entry."
  const { data, error } = (await supabase.rpc("start_time_entry" as never, {
    p_description: description.trim(),
    p_category: sel?.category ?? null,
    p_client_id: sel?.client_id ?? null,
    p_todo_id: todoId ?? null,
  } as never)) as unknown as {
    data: { id: string; started_at: string; description: string; category: string | null; client_id: string | null }[] | null;
    error: { message: string } | null;
  };

  if (error) return { error: error.message };
  const entry = data?.[0];
  if (!entry) return { error: "Failed to start timer" };
  revalidatePath("/tasks");
  return { entry };
}

// ── Todo <-> timer bridge ────────────────────────────────────────────────────

export async function startTodoTimer(todoId: string, title: string) {
  const result = await startTimer(title, undefined, todoId);
  revalidatePath("/todos");
  return result;
}

export async function finishTodoTimer(todoId: string, entryId: string) {
  await stopTimer(entryId);
  await toggleTodo(todoId, true);
  return { success: true };
}

export async function stopTimer(entryId: string) {
  const { supabase } = await requireAuth();

  // One round trip instead of a SELECT (fetch started_at) -> UPDATE chain —
  // stop_time_entry computes stopped_at/duration_seconds from Postgres's
  // own now() directly against the stored started_at.
  const { data, error } = (await supabase.rpc("stop_time_entry" as never, { p_entry_id: entryId } as never)) as unknown as {
    data: { id: string; duration_seconds: number }[] | null;
    error: { message: string } | null;
  };
  if (error) return { error: error.message };
  const result = data?.[0];
  if (!result) return { error: "Entry not found" };

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
    .update({ category: sel.category, client_id: sel.client_id })
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
      client_id: sel?.client_id ?? null,
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

export async function addManualEntry(
  description: string,
  durationSeconds: number,
  endedAt: string,
  sel?: CategorySelection
) {
  const { supabase, user } = await requireAuth();
  const end = new Date(endedAt);
  const start = new Date(end.getTime() - durationSeconds * 1000);
  const { error } = await supabase.from("time_entries").insert({
    user_id: user.id,
    description: description.trim(),
    started_at: start.toISOString(),
    stopped_at: end.toISOString(),
    duration_seconds: durationSeconds,
    category: sel?.category ?? null,
    client_id: sel?.client_id ?? null,
  });
  if (error) return { error: error.message };
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
