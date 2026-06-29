"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StyleTokens } from "@/lib/styles/types";
import type { Json } from "@/lib/db";
import { requireSiteRole, requirePageRole } from "@/lib/access/site-access";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function createHtmlPage(
  siteId: string,
  title: string,
  htmlContent: string
): Promise<{ pageId?: string; error?: string }> {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");

  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: countResult } = await supabase
    .from("site_pages")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("site_pages")
    .insert({
      user_id: user.id,
      site_id: siteId,
      title,
      slug,
      page_type: "html",
      page_data: [] as unknown as Json,
      html_content: htmlContent,
      status: "draft",
      sort_order: (countResult as unknown as number) ?? 99,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/my-site/${siteId}`);
  return { pageId: data.id };
}

export async function updateHtmlPage(
  pageId: string,
  htmlContent: string
): Promise<{ error?: string }> {
  const { supabase, user } = await requireAuth();
  await requirePageRole(supabase, pageId, user.id, "editor");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("site_pages")
    .update({ html_content: htmlContent, updated_at: new Date().toISOString() })
    .eq("id", pageId);
  if (error) return { error: error.message };
  return {};
}

export async function applyCustomStyle(
  siteId: string,
  tokens: StyleTokens
): Promise<{ error?: string }> {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("artist_sites")
    .update({
      style_key: "custom",
      custom_style: tokens as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", siteId);
  if (error) return { error: error.message };
  revalidatePath(`/my-site/${siteId}/style`);
  revalidatePath(`/my-site/${siteId}`);
  return {};
}
