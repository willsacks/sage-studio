"use server";

import { createClient } from "@/lib/supabase/server";
import type { PageData, PageTheme } from "@/lib/types/builder";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function saveOfferPage(
  pageId: string,
  {
    title,
    page_data,
    theme,
    status,
    slug,
    publish_mode,
    custom_domain,
  }: {
    title?: string;
    page_data?: PageData;
    theme?: PageTheme;
    status?: "draft" | "published";
    meta_title?: string;
    meta_description?: string;
    slug?: string;
    publish_mode?: string;
    custom_domain?: string;
  }
) {
  const { supabase, user } = await requireAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("offer_pages").update({
    ...(title !== undefined && { title }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(page_data !== undefined && { page_data: page_data as any }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(theme !== undefined && { theme: theme as any }),
    ...(status !== undefined && { status }),
    ...(slug !== undefined && { slug }),
    ...(publish_mode !== undefined && { publish_mode }),
    ...(custom_domain !== undefined && { custom_domain }),
    updated_at: new Date().toISOString(),
  }).eq("id", pageId).eq("owner_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function publishOfferPage(pageId: string, publish: boolean) {
  return saveOfferPage(pageId, { status: publish ? "published" : "draft" });
}

export async function verifyCustomDomain(pageId: string, domain: string) {
  const { supabase } = await requireAuth();
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
    const json = await res.json() as { Answer?: Array<{ data: string }> };
    const resolved = json.Answer?.[0]?.data;
    const verified = resolved === "76.76.21.21";
    await supabase
      .from("offer_pages")
      .update({ custom_domain_verified: verified, custom_domain: domain })
      .eq("id", pageId);
    return { verified, resolved };
  } catch {
    return { verified: false, error: "DNS lookup failed" };
  }
}
