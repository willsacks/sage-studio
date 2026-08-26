import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";

/**
 * The Resend connection lives on the USER (profiles.resend_api_key_encrypted),
 * not on any one site — an artist with several sites (e.g. a sculpture site
 * and a separate masonry business) connects Resend once and manages lists
 * that can span all of them. Returns null if the user hasn't connected
 * Resend yet, which every caller treats as "nothing to do" rather than an
 * error, since that's the common/default state.
 */
export async function getResendClientForUser(userId: string): Promise<Resend | null> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("resend_api_key_encrypted")
    .eq("id", userId)
    .single();

  const encryptedKey = profile?.resend_api_key_encrypted as string | null | undefined;
  if (!encryptedKey) return null;

  return new Resend(decryptSecret(encryptedKey));
}
