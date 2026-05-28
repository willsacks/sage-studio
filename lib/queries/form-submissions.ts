"use server";

import { createClient } from "@/lib/supabase/server";

export interface FormSubmission {
  id: string;
  created_at: string;
  form_title: string | null;
  site_slug: string | null;
  is_read: boolean;
  answers: Record<string, string>;
  questions: Array<{ id: string; label: string; type: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db() { return (await createClient()) as any; }

export async function getFormSubmissionsForSite(siteSlug: string): Promise<FormSubmission[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("site_slug", siteSlug)
    .order("created_at", { ascending: false });
  if (error) console.error("[getFormSubmissionsForSite]", error.message);
  return (data ?? []) as FormSubmission[];
}

export async function markSiteSubmissionsRead(siteSlug: string): Promise<void> {
  const supabase = await db();
  await supabase
    .from("form_submissions")
    .update({ is_read: true })
    .eq("site_slug", siteSlug)
    .eq("is_read", false);
}
