import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";

/**
 * Syncs a captured email into the SITE OWNER's own Resend Audience — not
 * the platform's Resend account (that one only sends transactional
 * notification emails, see app/api/form-submit/route.ts). No-ops silently
 * if the owner hasn't connected Resend, since that's the common case.
 */
export async function syncContactToResend(siteId: string, email: string): Promise<void> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: site } = await (supabase as any)
    .from("artist_sites")
    .select("resend_api_key_encrypted, resend_audience_id")
    .eq("id", siteId)
    .single();

  const encryptedKey = site?.resend_api_key_encrypted as string | null | undefined;
  const audienceId = site?.resend_audience_id as string | null | undefined;
  if (!encryptedKey || !audienceId) return;

  const apiKey = decryptSecret(encryptedKey);
  const resend = new Resend(apiKey);
  // Resend renamed Audiences -> Segments; `resend.contacts.create`'s current
  // (non-deprecated) shape takes `segments: [{ id }]` rather than a bare
  // `audienceId` string. The `resend.audiences` property name is kept for
  // backward compat (see setResendConnection's validation call), but the
  // contact-create payload shape has moved on — verified against
  // node_modules/resend/dist/index.d.mts rather than assumed.
  const { error } = await resend.contacts.create({ email, unsubscribed: false, segments: [{ id: audienceId }] });
  if (error) throw new Error(error.message);
}
