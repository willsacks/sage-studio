import { stripe } from "@/lib/stripe";

/** Creates a Stripe Express account for a creator who doesn't have one yet,
 * or returns their existing account id unchanged — same "create once, reuse
 * after" shape as app/api/checkout/route.ts's billing_customers lookup.
 * Express (not Standard) because onboarding is fully Stripe-hosted, which
 * is what lets this mirror the Plaid Link flow's "redirect out, come back"
 * shape with no custom KYC UI of our own to build. */
export async function ensureConnectAccount(params: { userId: string; existingAccountId: string | null; email: string }): Promise<string> {
  if (params.existingAccountId) return params.existingAccountId;

  const account = await stripe.accounts.create({
    type: "express",
    email: params.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { sage_studio_user_id: params.userId },
  });
  return account.id;
}

/** A fresh onboarding (or re-onboarding, if still incomplete) link — these
 * are single-use and short-lived, so callers always request a new one
 * rather than storing/reusing a URL. */
export async function createOnboardingLink(params: { accountId: string; returnUrl: string; refreshUrl: string }): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    type: "account_onboarding",
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });
  return link.url;
}

/** The platform's fee on a course sale when the creator has no explicit
 * override — Sage Studio takes no cut by default; makes money on the
 * monthly SaaS subscription instead (lib/stripe.ts's PRICE_IDS.pro). An
 * admin can override this per creator (profiles.course_platform_fee_bps),
 * including to an explicit 0 — which is why that column is nullable
 * rather than defaulting to 0 itself; null is "no override", not "zero". */
export const DEFAULT_COURSE_PLATFORM_FEE_BPS = 0;

export function resolveCoursePlatformFeeBps(override: number | null): number {
  return override ?? DEFAULT_COURSE_PLATFORM_FEE_BPS;
}
