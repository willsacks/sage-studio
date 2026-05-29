import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

const GUILD_PRICES: Record<string, { priceId: string; mode: "payment" | "subscription"; tierKey: string; tierLevel: number }> = {
  "3mo-full":     { priceId: "price_1TcHA8H8mL6VTVAA7JXOoCd9", mode: "payment",      tierKey: "guild_forge",     tierLevel: 2 },
  "3mo-monthly":  { priceId: "price_1TcHA8H8mL6VTVAAIJLt3HrM", mode: "subscription", tierKey: "guild_forge",     tierLevel: 2 },
  "6mo-full":     { priceId: "price_1TcHA8H8mL6VTVAASL9iV5rI", mode: "payment",      tierKey: "guild_forge",     tierLevel: 2 },
  "6mo-monthly":  { priceId: "price_1TcHA8H8mL6VTVAAxf3myLkJ", mode: "subscription", tierKey: "guild_forge",     tierLevel: 2 },
  "12mo-full":    { priceId: "price_1TcHA8H8mL6VTVAAUVCfnM6J", mode: "payment",      tierKey: "guild_forge",     tierLevel: 2 },
  "12mo-monthly": { priceId: "price_1TcHA9H8mL6VTVAAQyKs6OYJ", mode: "subscription", tierKey: "guild_forge",     tierLevel: 2 },
  "circle":       { priceId: "price_1TcHA7H8mL6VTVAA25HbgLnO", mode: "subscription", tierKey: "creators_circle", tierLevel: 1 },
};

export async function POST(request: NextRequest) {
  const { packageKey } = await request.json() as { packageKey?: string };

  const pkg = packageKey ? GUILD_PRICES[packageKey] : undefined;
  if (!pkg) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: pkg.mode,
      line_items: [{ price: pkg.priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: "https://willsage.com/guild/success",
      cancel_url: "https://willsage.com/guild/join",
      metadata: {
        checkout_type: "guild",
        tier_key: pkg.tierKey,
        tier_level: String(pkg.tierLevel),
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[guild-checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
