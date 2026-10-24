import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveCoursePlatformFeeBps } from "@/lib/stripe-connect";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";

/** Mirrors app/api/guild-checkout/route.ts's shape, but the price is
 * per-course (courses.price_cents) rather than a static Stripe Price, and
 * the payment is a destination charge — money goes straight to the
 * creator's own Connect account, not Sage Studio's.
 *
 * A free course (price_cents null/0) skips Stripe entirely — some
 * courses are deliberately free, not an oversight to warn about. It
 * still needs a real signed-in identity to enroll under (no email-
 * capture UI exists outside of Stripe Checkout), so an anonymous
 * visitor is asked to log in first instead. */
export async function POST(request: NextRequest) {
  const { courseId, redirectTo } = (await request.json()) as { courseId?: string; redirectTo?: string };
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ requiresLogin: true, loginUrl: `/login?next=${encodeURIComponent(redirectTo || `/my-courses/${course.id}`)}` });
    }

    // Enrollment inserts are normally course-owner-only (RLS) — a
    // self-serve free enroll bypasses that the same way the Stripe
    // webhook already does for a paid one, after confirming via the
    // cookie-scoped client above that this really is the signed-in
    // user, not an attacker-supplied id.
    const { error: insertError } = await admin.from("enrollments").insert({
      course_id: course.id,
      user_id: user.id,
      email: (user.email ?? "").toLowerCase(),
      status: "accepted",
      source: "manual",
      price_paid_cents: 0,
    });
    if (insertError && insertError.code !== "23505") {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ redirectUrl: redirectTo || `/my-courses/${course.id}` });
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
      success_url: `${appUrl()}${redirectTo || `/my-courses/${course.id}`}?enrolled=true`,
      cancel_url: `${appUrl()}/my-courses`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[course-checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
