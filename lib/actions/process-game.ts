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

// ── Game cells ────────────────────────────────────────────────────────────────

export async function upsertCell(position: number, label: string, color: string | null) {
  const { supabase, user } = await requireAuth();
  const trimmed = label.trim();

  if (!trimmed && !color) {
    await supabase
      .from("process_game_cells")
      .delete()
      .eq("user_id", user.id)
      .eq("position", position);
  } else {
    await supabase
      .from("process_game_cells")
      .upsert(
        { user_id: user.id, position, label: trimmed || null, color, updated_at: new Date().toISOString() },
        { onConflict: "user_id,position" }
      );
  }

  revalidatePath("/process-game");
  return { success: true };
}

// ── Programs ──────────────────────────────────────────────────────────────────

export async function createProgram(name: string, totalSpots: number, color: string) {
  const { supabase, user } = await requireAuth();

  const { data: last } = await supabase
    .from("process_game_programs")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("process_game_programs")
    .insert({ user_id: user.id, name: name.trim(), total_spots: totalSpots, color, position })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/process-game");
  return { program: data };
}

export async function updateProgram(id: string, name: string, totalSpots: number, color: string) {
  const { supabase, user } = await requireAuth();

  const { error } = await supabase
    .from("process_game_programs")
    .update({ name: name.trim(), total_spots: totalSpots, color })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/process-game");
  return { success: true };
}

export async function deleteProgram(id: string) {
  const { supabase, user } = await requireAuth();

  await supabase
    .from("process_game_programs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/process-game");
  return { success: true };
}

export async function reorderPrograms(orderedIds: string[]) {
  const { supabase, user } = await requireAuth();

  await Promise.all(
    orderedIds.map((id, position) =>
      supabase
        .from("process_game_programs")
        .update({ position })
        .eq("id", id)
        .eq("user_id", user.id)
    )
  );

  revalidatePath("/process-game");
  return { success: true };
}

// ── Spots ─────────────────────────────────────────────────────────────────────

export async function upsertSpot(programId: string, position: number, label: string, color: string | null) {
  const { supabase, user } = await requireAuth();

  // Verify program ownership
  const { data: prog } = await supabase
    .from("process_game_programs")
    .select("id")
    .eq("id", programId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!prog) return { error: "Not found" };

  const trimmed = label.trim();

  if (!trimmed && !color) {
    await supabase
      .from("process_game_spots")
      .delete()
      .eq("program_id", programId)
      .eq("position", position)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("process_game_spots")
      .upsert(
        { program_id: programId, user_id: user.id, position, label: trimmed || null, color, updated_at: new Date().toISOString() },
        { onConflict: "program_id,position" }
      );
  }

  revalidatePath("/process-game");
  return { success: true };
}
