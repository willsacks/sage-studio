import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

/** A separate endpoint (and separate signing secret, STRIPE_CONNECT_WEBHOOK_SECRET)
 * from app/api/webhooks/stripe/route.ts — Connect account events are their
 * own subscription in the Stripe Dashboard, distinct from the platform's
 * own checkout/subscription events, even though both ultimately call the
 * same `stripe` client. */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_CONNECT_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const supabase = createAdminClient();
    await supabase
      .from("profiles")
      .update({
        stripe_connect_charges_enabled: account.charges_enabled,
        stripe_connect_payouts_enabled: account.payouts_enabled,
      })
      .eq("stripe_connect_account_id", account.id);
  }

  return NextResponse.json({ received: true });
}
