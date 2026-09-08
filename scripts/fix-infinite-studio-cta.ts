/**
 * Patches the final CTA banner on the Infinite Studio page to use the correct copy.
 * Run: cd sage-studio && npx tsx scripts/fix-infinite-studio-cta.ts
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

const PAGE_ID = "2dc6cba1-bf96-4f7b-aea3-7ac5a68b598f";

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("page_data")
    .eq("id", PAGE_ID)
    .single();

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = page.page_data as any[];

  const ctaBlock = blocks.find((b) => b.id === "is-cta-final");
  if (!ctaBlock) throw new Error("CTA block not found");

  ctaBlock.data.heading = "The work that AI cannot do is the work that only you can do.";
  ctaBlock.data.subheading = "The Infinite Studio is how you prepare for that work.";
  ctaBlock.data.ctaText = "Join the Waitlist";

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ page_data: blocks })
    .eq("id", PAGE_ID);

  if (updateError) throw updateError;
  console.log("✓ CTA banner updated with correct copy.");
}

main().catch((err) => { console.error(err); process.exit(1); });
