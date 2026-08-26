import { createAdminClient } from "@/lib/supabase/server";
import { getResendClientForUser } from "./resend-client";

/**
 * Syncs a captured email into the SITE OWNER's own Resend lists (never the
 * acting collaborator's — the Resend connection belongs to whoever owns
 * the site, same "owner's plan/account, not the collaborator's" pattern
 * used elsewhere, e.g. addSitePage's plan-gate check) — not the platform's
 * Resend account (that one only sends transactional notification emails,
 * see app/api/form-submit/route.ts). No-ops silently if the owner hasn't
 * connected Resend, or if this site hasn't been configured to feed any
 * list, since both are the common/default state.
 *
 * Returns whether a sync was actually attempted+succeeded (true) vs skipped
 * (false) — record-subscriber.ts uses this to avoid recording
 * `resend_synced_at` for a no-op, which would otherwise misreport "synced"
 * for sites with nothing configured.
 */
export async function syncContactToResend(siteId: string, email: string): Promise<boolean> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: site } = await (supabase as any)
    .from("artist_sites")
    .select("user_id, resend_list_ids")
    .eq("id", siteId)
    .single();

  const listIds = (site?.resend_list_ids as string[] | null) ?? [];
  if (!site?.user_id || listIds.length === 0) return false;

  const resend = await getResendClientForUser(site.user_id);
  if (!resend) return false;

  // Resend renamed Audiences -> Segments; `resend.contacts.create`'s current
  // (non-deprecated) shape takes `segments: [{ id }][]` rather than a bare
  // `audienceId` string — verified against node_modules/resend/dist/index.d.mts
  // rather than assumed. A contact can belong to several lists at once,
  // matching how this site may be configured to feed more than one.
  const { error } = await resend.contacts.create({
    email,
    unsubscribed: false,
    segments: listIds.map((id) => ({ id })),
  });
  if (error) throw new Error(error.message);
  return true;
}
