"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_SYSTEM_BLOCK, DEFAULT_SYSTEM_HTML } from "@/lib/ai/prompts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function requireAdmin(): Promise<AnyClient> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Not authorized");
  return createAdminClient();
}

export async function toggleUserAiAccess(userId: string, enabled: boolean) {
  const admin = await requireAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ ai_assistant_enabled: enabled })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function getAiPrompts() {
  const admin = await requireAdmin();
  const { data } = await admin
    .from("platform_settings")
    .select("ai_block_system_prompt, ai_html_system_prompt")
    .maybeSingle();
  return {
    blockPrompt: data?.ai_block_system_prompt || DEFAULT_SYSTEM_BLOCK,
    htmlPrompt: data?.ai_html_system_prompt || DEFAULT_SYSTEM_HTML,
  };
}

export async function saveAiPrompts(blockPrompt: string, htmlPrompt: string) {
  const admin = await requireAdmin();
  const { error } = await admin
    .from("platform_settings")
    .upsert({ id: true, ai_block_system_prompt: blockPrompt, ai_html_system_prompt: htmlPrompt, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}
