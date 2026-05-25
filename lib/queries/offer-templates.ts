import type { PageData, PageTheme } from "@/lib/types/builder";

// Stub type for offer templates — stubbed since templates come from site page templates in Sage Studio
export type OfferTemplate = {
  id: string;
  owner_id: string | null;
  owner_type: string;
  name: string;
  description: string | null;
  category: string | null;
  page_data: PageData;
  theme: PageTheme | null;
  promoted: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
  // Extended fields used by Builder
  template_key?: string | null;
  thumbnail_url?: string | null;
  status?: string;
  is_promoted?: boolean;
};

// Stubbed — Sage Studio does not use platform/personal offer templates
export async function getPlatformTemplates(): Promise<OfferTemplate[]> {
  return [];
}

export async function getMyTemplates(): Promise<OfferTemplate[]> {
  return [];
}
