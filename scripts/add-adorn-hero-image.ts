/**
 * Adds the user-supplied "Leslie Adorn Hero.png" as the hero background photo
 * on the Adorn page (currently a flat CSS-gradient background with no image).
 * The existing gold/sage accent radial-gradients are kept as-is; the base
 * linear-gradient (previously fully opaque) becomes a semi-transparent dark
 * tint layered over the photo, so the hero text stays legible while the
 * photo shows through — matching the moody, dark aesthetic already in place.
 * The source PNG (2.4MB, no alpha channel) is re-encoded as an 85%-quality
 * JPEG (286KB) since this is a photo, not line art.
 * Run: cd sage-studio && npx tsx scripts/add-adorn-hero-image.ts
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

const PAGE_ID = "c69df5b7-61d1-4746-8c6e-47ceed90f4d7"; // Adorn page

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  const oldRule = `.hero-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 70% 40%, rgba(184,154,106,0.18) 0%, transparent 65%),
      radial-gradient(ellipse 60% 80% at 20% 70%, rgba(122,140,120,0.14) 0%, transparent 60%),
      linear-gradient(160deg, #1a1612 0%, #231e18 50%, #1c1a16 100%);
  }`;
  if (!html.includes(oldRule)) throw new Error(".hero-bg rule not found as expected");

  const newBase64 = readFileSync("/tmp/adorn-hero-b64.txt", "utf-8").trim();
  const newRule = `.hero-bg {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(ellipse 80% 60% at 70% 40%, rgba(184,154,106,0.18) 0%, transparent 65%),
      radial-gradient(ellipse 60% 80% at 20% 70%, rgba(122,140,120,0.14) 0%, transparent 60%),
      linear-gradient(160deg, rgba(26,22,18,0.82) 0%, rgba(35,30,24,0.75) 50%, rgba(28,26,22,0.85) 100%),
      url('data:image/jpeg;base64,${newBase64}');
    background-size: auto, auto, auto, cover;
    background-position: center, center, center, center;
    background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
  }`;
  html = html.replace(oldRule, newRule);
  console.log("✓ Hero background image added with dark tint overlay.");

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
