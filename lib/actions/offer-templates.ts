"use server";

import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

// Stubbed — Sage Studio does not use offer templates via this action
export async function saveAsTemplate(
  pageId: string,
  { name, description, thumbnailUrl }: { name: string; description?: string; thumbnailUrl?: string }
) {
  // No-op stub — template saving not implemented in Sage Studio
  void pageId; void name; void description; void thumbnailUrl;
  return { success: true, error: undefined } as { success: boolean; error?: string };
}
