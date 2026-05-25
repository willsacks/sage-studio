import Stripe from "stripe";

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
