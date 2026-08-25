import { createAdminClient } from "@/lib/supabase/server";
import { syncContactToResend } from "./resend-sync";

export type GateSourceType = "file_gate" | "page_gate";

/**
 * Shared by both gate-unlock routes (file and page). Persists the
 * subscriber first — that write must succeed for the caller to proceed —
 * then best-effort syncs to the owner's Resend Audience. A sync failure
 * never propagates to the caller (same "swallow errors" philosophy as the
 * owner-notification email in app/api/form-submit/route.ts): the row
 * records `resend_sync_error` for later debugging instead.
 */
export async function recordSubscriberAndSync(params: {
  siteId: string;
  siteSlug: string;
  email: string;
  sourceType: GateSourceType;
  sourceId: string;
}): Promise<void> {
  const { siteId, siteSlug, email, sourceType, sourceId } = params;
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("email_subscribers")
    .upsert(
      { site_id: siteId, site_slug: siteSlug, email, source_type: sourceType, source_id: sourceId },
      { onConflict: "site_id,email,source_type,source_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);

  try {
    await syncContactToResend(siteId, email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("email_subscribers")
      .update({ resend_synced_at: new Date().toISOString(), resend_sync_error: null })
      .eq("site_id", siteId).eq("email", email).eq("source_type", sourceType).eq("source_id", sourceId);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("email_subscribers")
      .update({ resend_sync_error: err instanceof Error ? err.message : String(err) })
      .eq("site_id", siteId).eq("email", email).eq("source_type", sourceType).eq("source_id", sourceId);
  }
}
