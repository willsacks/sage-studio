import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";
import type { PageData, PageTheme } from "@/lib/types/builder";

export type OfferTemplate = Tables<"offer_templates"> & {
  page_data: PageData;
  theme: PageTheme | null;
  template_key?: string | null;
  thumbnail_url?: string | null;
  name: string; // alias for title — components reference .name
  is_promoted?: boolean; // alias for promoted
};

export async function getMyTemplates(): Promise<OfferTemplate[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("offer_templates")
    .select("*")
    .eq("owner_id", user.id)
    .eq("owner_type", "member")
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as OfferTemplate[];
}

// Stub — platform templates not used in Sage Studio
export async function getPlatformTemplates(): Promise<OfferTemplate[]> {
  return [];
}
