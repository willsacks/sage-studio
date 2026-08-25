import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves an EmailGateBlock's storage path authoritatively from the site's
 * own page_data, keyed by (siteId, blockId) — the caller must NEVER trust a
 * client-supplied filePath directly, since that would let anyone request a
 * signed URL for any file on any site by pairing an arbitrary siteSlug with
 * a filePath copied from a different site's response (there is otherwise
 * nothing tying the two together). Scans every page's blocks since a block
 * id alone doesn't say which page it lives on.
 */
export async function findGateBlockFilePath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  siteId: string,
  blockId: string
): Promise<string | null> {
  const { data: pages } = await supabase
    .from("site_pages")
    .select("page_data")
    .eq("site_id", siteId);

  for (const page of pages ?? []) {
    const blocks = (page as { page_data: unknown }).page_data as
      | { id: string; type: string; data?: { filePath?: string } }[]
      | null;
    const match = blocks?.find((b) => b.id === blockId && b.type === "email_gate");
    if (match?.data?.filePath) return match.data.filePath;
  }
  return null;
}
