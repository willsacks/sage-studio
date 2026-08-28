"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function listFinanceProjects(entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "viewer");

  const { data, error } = await supabase
    .from("finance_projects")
    .select("*")
    .eq("entity_id", entityId)
    .order("display_order", { ascending: true });
  if (error) return { error: error.message, projects: [] };
  return { projects: data ?? [] };
}

export async function createFinanceProject(params: {
  entityId: string;
  name: string;
  projectType?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  description?: string;
  clientName?: string;
}) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, params.entityId, user.id, "editor");

  const name = params.name.trim();
  if (!name) return { error: "A project name is required" };

  const { data, error } = await supabase
    .from("finance_projects")
    .insert({
      entity_id: params.entityId,
      name,
      project_type: params.projectType?.trim() || null,
      start_date: params.startDate || null,
      end_date: params.endDate || null,
      budget: params.budget ?? null,
      description: params.description?.trim() || null,
      client_name: params.clientName?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { projectId: data.id as string };
}

export async function updateFinanceProject(
  projectId: string,
  entityId: string,
  updates: {
    name?: string;
    projectType?: string | null;
    status?: "active" | "completed" | "archived";
    startDate?: string | null;
    endDate?: string | null;
    budget?: number | null;
    description?: string | null;
    clientName?: string | null;
  }
) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase
    .from("finance_projects")
    .update({
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.projectType !== undefined ? { project_type: updates.projectType } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.startDate !== undefined ? { start_date: updates.startDate } : {}),
      ...(updates.endDate !== undefined ? { end_date: updates.endDate } : {}),
      ...(updates.budget !== undefined ? { budget: updates.budget } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.clientName !== undefined ? { client_name: updates.clientName } : {}),
    })
    .eq("id", projectId)
    .eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}

export async function deleteFinanceProject(projectId: string, entityId: string) {
  const { supabase, user } = await requireAuth();
  await requireFinanceEntityRole(supabase, entityId, user.id, "editor");

  const { error } = await supabase.from("finance_projects").delete().eq("id", projectId).eq("entity_id", entityId);
  if (error) return { error: error.message };
  revalidatePath("/finances");
  return { success: true };
}
