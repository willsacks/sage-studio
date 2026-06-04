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

// ── Sections ──────────────────────────────────────────────────────────────────

export async function createSection(title: string, emoji: string | null, color: string) {
  const { supabase, user } = await requireAuth();

  const { data: last } = await supabase
    .from("knowledge_sections")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("knowledge_sections")
    .insert({ user_id: user.id, title: title.trim(), emoji: emoji || null, color, position })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/knowledge");
  return { section: data };
}

export async function updateSection(
  id: string,
  fields: { title?: string; emoji?: string | null; color?: string }
) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("knowledge_sections")
    .update({ ...fields, title: fields.title?.trim() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/knowledge");
}

export async function deleteSection(id: string) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("knowledge_sections")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/knowledge");
}

export async function reorderSections(orderedIds: string[]) {
  const { supabase, user } = await requireAuth();
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from("knowledge_sections")
        .update({ position: i })
        .eq("id", id)
        .eq("user_id", user.id)
    )
  );
  revalidatePath("/knowledge");
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function createEntry(sectionId: string | null) {
  const { supabase, user } = await requireAuth();

  const { data: last } = await supabase
    .from("knowledge_entries")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("knowledge_entries")
    .insert({
      user_id: user.id,
      section_id: sectionId,
      title: "Untitled",
      body: "",
      position,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/knowledge");
  return { entry: data };
}

export async function updateEntry(
  id: string,
  fields: { title?: string; body?: string; section_id?: string | null }
) {
  const { supabase, user } = await requireAuth();
  const updates: Record<string, unknown> = {
    ...fields,
    updated_at: new Date().toISOString(),
  };
  if (fields.title !== undefined) {
    updates.title = fields.title.trim() || "Untitled";
  }
  await supabase
    .from("knowledge_entries")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/knowledge");
}

export async function deleteEntry(id: string) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("knowledge_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/knowledge");
}
