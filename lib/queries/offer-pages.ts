import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db";
import type { PageData, PageTheme } from "@/lib/types/builder";

export type OfferPage = Tables<"offer_pages"> & {
  page_data: PageData;
  theme: PageTheme | null;
  status?: "draft" | "published";
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  og_title?: string | null;
  og_description?: string | null;
};

export async function getOfferPageById(id: string): Promise<OfferPage | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offer_pages")
    .select("*")
    .eq("id", id)
    .single();
  return data as OfferPage | null;
}
