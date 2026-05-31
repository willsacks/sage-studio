"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const DEFAULT_STAGES = [
  { name: "Prospect",      color: "#64748B", position: 0 },
  { name: "Scheduling",    color: "#8B5CF6", position: 1 },
  { name: "In Production", color: "#F59E0B", position: 2 },
  { name: "Mix & Master",  color: "#F97316", position: 3 },
  { name: "Released",      color: "#10B981", position: 4 },
];

async function requireAuth() {
  const supabase = (await createClient()) as AnyClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// ── Stages ────────────────────────────────────────────────────────────────────

export async function ensureDefaultStages() {
  const { supabase, user } = await requireAuth();

  const { data: existing } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) return;

  await supabase.from("pipeline_stages").insert(
    DEFAULT_STAGES.map((s) => ({ ...s, user_id: user.id }))
  );
}

export async function createStage(name: string, color: string) {
  const { supabase, user } = await requireAuth();

  const { data: last } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({ user_id: user.id, name: name.trim(), color, position })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/pipeline");
  return { stage: data };
}

export async function updateStage(id: string, name: string, color: string) {
  const { supabase, user } = await requireAuth();

  const { error } = await supabase
    .from("pipeline_stages")
    .update({ name: name.trim(), color })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/pipeline");
  return { success: true };
}

export async function deleteStage(id: string) {
  const { supabase, user } = await requireAuth();

  await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/pipeline");
  return { success: true };
}

export async function reorderStages(orderedIds: string[]) {
  const { supabase, user } = await requireAuth();

  await Promise.all(
    orderedIds.map((id, position) =>
      supabase
        .from("pipeline_stages")
        .update({ position })
        .eq("id", id)
        .eq("user_id", user.id)
    )
  );

  revalidatePath("/pipeline");
  return { success: true };
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function createContact(name: string, stageId: string | null) {
  const { supabase, user } = await requireAuth();

  const { data, error } = await supabase
    .from("pipeline_contacts")
    .insert({ user_id: user.id, name: name.trim(), stage_id: stageId })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/pipeline");
  return { contactId: data.id };
}

export async function updateContact(
  id: string,
  fields: {
    name?: string;
    stage_id?: string | null;
    notes?: string;
    collaborators?: string;
    next_session?: string | null;
    next_action?: string | null;
  }
) {
  const { supabase, user } = await requireAuth();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) update.name = fields.name.trim();
  if ("stage_id" in fields) update.stage_id = fields.stage_id;
  if (fields.notes !== undefined) update.notes = fields.notes;
  if (fields.collaborators !== undefined) update.collaborators = fields.collaborators;
  if ("next_session" in fields) update.next_session = fields.next_session;
  if ("next_action" in fields) update.next_action = fields.next_action;

  const { error } = await supabase
    .from("pipeline_contacts")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/pipeline");
  return { success: true };
}

export async function deleteContact(id: string) {
  const { supabase, user } = await requireAuth();

  await supabase
    .from("pipeline_contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/pipeline");
  return { success: true };
}
