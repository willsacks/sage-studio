import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_SAGE_STUDIO_PRICE_PRO!,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Get or create Stripe customer
  let customerId: string | undefined;
  const { data: billing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (billing?.stripe_customer_id) {
    customerId = billing.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id, platform: "sage_studio" },
    });
    customerId = customer.id;
    await supabase.from("billing_customers").insert({
      user_id: user.id,
      stripe_customer_id: customer.id,
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    metadata: { user_id: user.id, platform: "sage_studio" },
  });

  return NextResponse.redirect(session.url!);
}
