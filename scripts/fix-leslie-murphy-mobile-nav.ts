/**
 * On mobile, the nav (title + menu) floats transparently over the hero photo
 * triptych until the user scrolls past 60px (existing `nav.scrolled` class,
 * toggled by the page's own scroll listener) — white text over a light photo
 * is unreadable. Rather than change the scroll threshold or the photos, this
 * hides the nav entirely while at the top on mobile, and lets it fade in
 * with its existing dark `.scrolled` background as soon as the user scrolls
 * — reusing the page's own existing scroll mechanism, no JS changes needed.
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-mobile-nav.ts
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

const PAGE_ID = "0524e4b0-72d4-4d22-81fc-a7bb508a605d";

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  const oldNavRule = "nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:24px 40px;transition:background .4s,padding .3s}";
  if (!html.includes(oldNavRule)) throw new Error("nav CSS rule not found as expected");
  html = html.replace(oldNavRule, oldNavRule.replace("transition:background .4s,padding .3s", "transition:background .4s,padding .3s,opacity .3s"));
  console.log("✓ nav transition extended to include opacity.");

  const mediaMarker = "@media(max-width:700px){";
  const mediaIdx = html.indexOf(mediaMarker);
  if (mediaIdx === -1) throw new Error("@media(max-width:700px) block not found");
  const insertAt = mediaIdx + mediaMarker.length;
  const hideRule = "nav:not(.scrolled){opacity:0;pointer-events:none}";
  if (html.includes(hideRule)) {
    console.log("• Mobile hide rule already present, skipped.");
  } else {
    html = html.slice(0, insertAt) + hideRule + html.slice(insertAt);
    console.log("✓ Nav now hidden on mobile until scrolled (fades in with its existing dark background).");
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
