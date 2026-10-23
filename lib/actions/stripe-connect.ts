"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureConnectAccount, createOnboardingLink } from "@/lib/stripe-connect";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";

/** Starts (or resumes) Stripe Connect Express onboarding for the current
 * user — a full-page redirect to a Stripe-hosted form, same "hand off to
 * the provider, come back via a return URL" shape as Plaid Link, just
 * without a JS SDK popup since Connect onboarding doesn't need one. */
export async function startStripeConnectOnboarding() {
  const { supabase, user } = await requireAuth();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single();
  if (profileError) return { error: profileError.message };

  try {
    const accountId = await ensureConnectAccount({
      userId: user.id,
      existingAccountId: profile.stripe_connect_account_id,
      email: user.email ?? "",
    });

    if (!profile.stripe_connect_account_id) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);
      if (updateError) return { error: updateError.message };
    }

    const url = await createOnboardingLink({
      accountId,
      returnUrl: `${appUrl()}/settings/stripe-connect-return`,
      refreshUrl: `${appUrl()}/settings/stripe-connect-return?refresh=true`,
    });
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to start Stripe Connect onboarding" };
  }
}
