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

export async function saveAsTemplate(
  pageId: string,
  { name, description }: { name: string; description?: string; thumbnailUrl?: string }
) {
  const { supabase, user } = await requireAuth();

  // Fetch page data to copy into template
  const { data: page } = await supabase
    .from("site_pages")
    .select("page_data, theme, title")
    .eq("id", pageId)
    .eq("user_id", user.id)
    .single();

  if (!page) return { success: false, error: "Page not found" } as { success: boolean; error?: string };

  const { error } = await supabase.from("offer_templates").insert({
    owner_id: user.id,
    owner_type: "member",
    title: name,
    description: description ?? null,
    page_data: page.page_data,
    theme: page.theme,
  });

  if (error) return { success: false, error: error.message } as { success: boolean; error?: string };

  revalidatePath("/my-templates");
  return { success: true, error: undefined } as { success: boolean; error?: string };
}

export async function deletePersonalTemplate(templateId: string) {
  const { supabase, user } = await requireAuth();
  await supabase
    .from("offer_templates")
    .delete()
    .eq("id", templateId)
    .eq("owner_id", user.id);
  revalidatePath("/my-templates");
}
