import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

const GUILD_PRICES: Record<string, { priceId: string; mode: "payment" | "subscription"; tierKey: string; tierLevel: number }> = {
  "3mo-full":     { priceId: "price_1Tb2eOH8mL6VTVAAhspixqIy", mode: "payment",      tierKey: "guild_forge",     tierLevel: 2 },
  "3mo-monthly":  { priceId: "price_1Tb2ePH8mL6VTVAA6mOicU6u", mode: "subscription", tierKey: "guild_forge",     tierLevel: 2 },
  "6mo-full":     { priceId: "price_1Tb2eOH8mL6VTVAAh9LfMiwI", mode: "payment",      tierKey: "guild_forge",     tierLevel: 2 },
  "6mo-monthly":  { priceId: "price_1Tb2ePH8mL6VTVAA8SZxwxlb", mode: "subscription", tierKey: "guild_forge",     tierLevel: 2 },
  "12mo-full":    { priceId: "price_1Tb2eOH8mL6VTVAAtUcZpiKx", mode: "payment",      tierKey: "guild_forge",     tierLevel: 2 },
  "12mo-monthly": { priceId: "price_1Tb2ePH8mL6VTVAAkOUwxyRs", mode: "subscription", tierKey: "guild_forge",     tierLevel: 2 },
  "circle":       { priceId: "price_1Tb2eOH8mL6VTVAAXnhaPkmo", mode: "subscription", tierKey: "creators_circle", tierLevel: 1 },
};

export async function POST(request: NextRequest) {
  const { packageKey } = await request.json() as { packageKey?: string };

  const pkg = packageKey ? GUILD_PRICES[packageKey] : undefined;
  if (!pkg) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";

  const session = await stripe.checkout.sessions.create({
    mode: pkg.mode,
    line_items: [{ price: pkg.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${baseUrl}/guild/success`,
    cancel_url: `${baseUrl}/guild/join`,
    metadata: {
      checkout_type: "guild",
      tier_key: pkg.tierKey,
      tier_level: String(pkg.tierLevel),
    },
  });

  return NextResponse.json({ url: session.url });
}
