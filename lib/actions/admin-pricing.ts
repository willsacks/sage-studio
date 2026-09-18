"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { canManagePlatform } from "@/lib/access/platform-access";
import { stripe, PRICE_IDS } from "@/lib/stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function requireManage(): Promise<AnyClient> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canManagePlatform(profile?.role)) throw new Error("Not authorized");
  return createAdminClient();
}

export async function getPlatformPricing() {
  const admin = await requireManage();
  const { data } = await admin.from("platform_settings").select("pro_price_id, pro_price_cents").maybeSingle();
  if (data?.pro_price_cents) return { priceCents: data.pro_price_cents, priceId: data.pro_price_id };

  // No override saved yet — reflect whatever the env-configured price
  // actually costs today, so the admin sees the real current price on
  // first load rather than a blank field.
  try {
    const price = await stripe.prices.retrieve(PRICE_IDS.pro);
    return { priceCents: price.unit_amount ?? 0, priceId: null };
  } catch {
    return { priceCents: 0, priceId: null };
  }
}

/** Stripe prices are immutable — "changing the price" means creating a new
 * Price under the same Product and pointing future checkouts at it (see
 * lib/stripe.ts's getEffectiveProPriceId). Existing subscribers keep
 * whatever price they already agreed to; this only affects new signups. */
export async function updatePlatformPricing(newPriceDollars: number) {
  const admin = await requireManage();
  if (!Number.isFinite(newPriceDollars) || newPriceDollars <= 0) return { error: "Enter a valid price" };
  const newPriceCents = Math.round(newPriceDollars * 100);

  try {
    const { data: existing } = await admin.from("platform_settings").select("pro_price_id").maybeSingle();
    const currentPriceId = existing?.pro_price_id || PRICE_IDS.pro;
    const currentPrice = await stripe.prices.retrieve(currentPriceId);

    const newPrice = await stripe.prices.create({
      product: typeof currentPrice.product === "string" ? currentPrice.product : currentPrice.product.id,
      unit_amount: newPriceCents,
      currency: currentPrice.currency,
      recurring: currentPrice.recurring ? { interval: currentPrice.recurring.interval } : undefined,
    });

    // Archive the old override (not the very first, env-configured price —
    // that one isn't ours to deactivate) so it can't be picked up by an
    // old cached checkout link.
    if (existing?.pro_price_id) {
      await stripe.prices.update(existing.pro_price_id, { active: false });
    }

    await admin.from("platform_settings").upsert({ id: true, pro_price_id: newPrice.id, pro_price_cents: newPriceCents, updated_at: new Date().toISOString() });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update pricing" };
  }

  revalidatePath("/admin/pricing");
  return { success: true };
}

function discountCouponId(percent: number): string {
  return `admin-discount-${percent}pct`;
}

async function getOrCreateCoupon(percent: number): Promise<string> {
  const id = discountCouponId(percent);
  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch {
    const coupon = await stripe.coupons.create({
      id,
      percent_off: percent,
      duration: "forever",
      name: `Admin-granted ${percent}% off`,
    });
    return coupon.id;
  }
}

/** Applies a percent-off Stripe coupon directly to a user's active
 * subscription. The coupon is the source of truth for billing;
 * profiles.active_discount_percent is only a display cache so the admin
 * UI doesn't need a Stripe round trip to show what's active. */
export async function applyUserDiscount(userId: string, percent: number) {
  const admin = await requireManage();
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { error: "Enter a percent between 1 and 100" };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!sub?.stripe_subscription_id) return { error: "This user has no active subscription to discount" };

  try {
    const couponId = await getOrCreateCoupon(Math.round(percent));
    await stripe.subscriptions.update(sub.stripe_subscription_id, { discounts: [{ coupon: couponId }] });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to apply discount" };
  }

  await admin.from("profiles").update({ active_discount_percent: Math.round(percent) }).eq("id", userId);
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function removeUserDiscount(userId: string) {
  const admin = await requireManage();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (sub?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { discounts: [] });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to remove discount" };
    }
  }

  await admin.from("profiles").update({ active_discount_percent: null }).eq("id", userId);
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}
