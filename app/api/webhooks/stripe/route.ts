import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const platform = session.metadata?.platform;

    if (!userId || platform !== "sage_studio") return NextResponse.json({ received: true });

    // Upgrade to Pro
    await supabase
      .from("profiles")
      .update({ tier_key: "studio_pro", tier_level: 5 })
      .eq("id", userId);

    // Record subscription
    if (session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const item = sub.items.data[0];
      await supabase.from("subscriptions").upsert({
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_price_id: item?.price.id ?? null,
        plan: "studio_pro",
        status: sub.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current_period_start: item ? new Date((item as any).current_period_start * 1000).toISOString() : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current_period_end: item ? new Date((item as any).current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const { data: billing } = await supabase
      .from("billing_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (billing?.user_id) {
      await supabase
        .from("profiles")
        .update({ tier_key: "free", tier_level: 0 })
        .eq("id", billing.user_id);

      await supabase
        .from("subscriptions")
        .update({ status: "canceled", cancel_at_period_end: false })
        .eq("stripe_subscription_id", sub.id);
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const updItem = sub.items.data[0];
    await supabase
      .from("subscriptions")
      .update({
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current_period_end: updItem ? new Date((updItem as any).current_period_end * 1000).toISOString() : null,
      })
      .eq("stripe_subscription_id", sub.id);
  }

  return NextResponse.json({ received: true });
}
