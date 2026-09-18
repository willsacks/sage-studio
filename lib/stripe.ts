import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

// Sage Studio price IDs (provisioned in both test and live modes)
export const PRICE_IDS = {
  free: process.env.STRIPE_SAGE_STUDIO_PRICE_FREE!,
  pro: process.env.STRIPE_SAGE_STUDIO_PRICE_PRO!,
} as const;

/** The Pro plan's Stripe Price for new checkouts — platform_settings.pro_price_id
 * (set by an admin via Admin > Pricing) overrides the env-configured price
 * when present, since Stripe prices are immutable and a pricing change
 * always means pointing at a newly created Price object. */
export async function getEffectiveProPriceId(): Promise<string> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any).from("platform_settings").select("pro_price_id").maybeSingle();
  return data?.pro_price_id || PRICE_IDS.pro;
}
