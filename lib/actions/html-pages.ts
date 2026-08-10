"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StyleTokens } from "@/lib/styles/types";
import type { Json } from "@/lib/db";
import { requireSiteRole } from "@/lib/access/site-access";
import { revalidateSiteCache } from "@/lib/queries/sites";

// createHtmlPage / updateHtmlPage used to live here as Server Actions, but a
// large HTML string (real imported pages commonly run 500KB-1MB+) trips a
// hardcoded ~1,000,000-unit limit in React's Server Actions argument decoder
// that next.config's serverActions.bodySizeLimit does NOT control. They're
// now plain route handlers instead: app/api/site-pages/import-html and
// app/api/site-pages/update-html.

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
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
  await revalidateSiteCache(siteId);
  return {};
}
