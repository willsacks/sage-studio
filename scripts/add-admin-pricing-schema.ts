/**
 * Admin pricing/discount controls (Platform Admin > Pricing):
 * - platform_settings.pro_price_id / pro_price_cents: an override for the
 *   Pro plan's Stripe Price, set when an admin changes pricing. Falls
 *   back to STRIPE_SAGE_STUDIO_PRICE_PRO (env) when unset — see
 *   lib/stripe.ts's getEffectiveProPriceId().
 * - profiles.active_discount_percent: display/audit copy of a discount
 *   applied to a user's subscription. The actual discount lives on the
 *   Stripe subscription itself (a Stripe coupon) — this column is never
 *   the source of truth, just what the admin UI shows without an extra
 *   Stripe round trip.
 *
 * Run: cd sage-studio && npx tsx scripts/add-admin-pricing-schema.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, {
    sql: `
      alter table public.platform_settings add column if not exists pro_price_id text;
      alter table public.platform_settings add column if not exists pro_price_cents integer;
      alter table public.profiles add column if not exists active_discount_percent smallint;
    `,
  } as never);
  if (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
  else console.log("✓ add admin pricing/discount columns");
}

main().catch((err) => { console.error(err); process.exit(1); });
