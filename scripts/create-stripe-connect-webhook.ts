/**
 * One-time setup: registers the live Stripe Connect webhook endpoint
 * (app/api/webhooks/stripe-connect/route.ts) and prints its signing
 * secret, which then needs adding to Vercel as
 * STRIPE_CONNECT_WEBHOOK_SECRET. Safe to re-run — Stripe just creates
 * another endpoint if run twice; delete the stale one in the Dashboard
 * (Developers → Webhooks) if that happens.
 *
 * Run: cd sage-studio && npx tsx scripts/create-stripe-connect-webhook.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });

async function main() {
  const endpoint = await stripe.webhookEndpoints.create({
    url: "https://sagestudio.org/api/webhooks/stripe-connect",
    enabled_events: ["account.updated"],
    connect: true,
    description: "Sage Studio — Stripe Connect account status (course creator payouts)",
  });
  console.log(`✓ Created Connect webhook endpoint: ${endpoint.id}`);
  console.log(`  Signing secret: ${endpoint.secret}`);
  console.log("  Add this as STRIPE_CONNECT_WEBHOOK_SECRET in Vercel.");
}

main().catch((err) => { console.error(err); process.exit(1); });
