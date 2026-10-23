import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveCoursePlatformFeeBps } from "@/lib/stripe-connect";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";

/** Mirrors app/api/guild-checkout/route.ts's shape, but the price is
 * per-course (courses.price_cents) rather than a static Stripe Price, and
 * the payment is a destination charge — money goes straight to the
 * creator's own Connect account, not Sage Studio's. */
export async function POST(request: NextRequest) {
  const { courseId } = (await request.json()) as { courseId?: string };
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: course } = await (admin as any)
    .from("courses")
    .select("id, title, price_cents, status, owner_id")
    .eq("id", courseId)
    .single();
  if (!course || course.status !== "published") {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!course.price_cents || course.price_cents <= 0) {
    return NextResponse.json({ error: "This course doesn't have a price set" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner } = await (admin as any)
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_charges_enabled, course_platform_fee_bps")
    .eq("id", course.owner_id)
    .single();
  if (!owner?.stripe_connect_account_id || !owner.stripe_connect_charges_enabled) {
    return NextResponse.json({ error: "This creator hasn't finished setting up payments yet" }, { status: 400 });
  }

  const feeBps = resolveCoursePlatformFeeBps(owner.course_platform_fee_bps ?? null);
  const applicationFeeAmount = Math.round((course.price_cents * feeBps) / 10000);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: course.title },
            unit_amount: course.price_cents,
          },
          quantity: 1,
        },
      ],
      customer_email: user?.email ?? undefined,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: { destination: owner.stripe_connect_account_id },
      },
      metadata: { checkout_type: "course_enrollment", course_id: course.id },
      success_url: `${appUrl()}/my-courses/${course.id}?enrolled=true`,
      cancel_url: `${appUrl()}/my-courses`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[course-checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
