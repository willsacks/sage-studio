/**
 * Three content tweaks to Leslie Murphy's home page (lesliemurphy.com):
 *  1. Swap in the new Owl's Nest Farm logo the user dropped in the project root.
 *  2. Make the Adorn logo 25% bigger than its current inline size.
 *  3. Stop the "All rights reserved" footer link from rendering browser-default blue.
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-home-tweaks.ts
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
const LOGO_PATH = resolve(process.cwd(), "Owls Nest Farm Logo.png");

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  // 1. Owl's Nest logo swap
  const owlMarker = "https://www.theowlsnestfarmandshop.com/";
  const owlIdx = html.indexOf(owlMarker);
  if (owlIdx === -1) throw new Error("Owl's Nest anchor not found");
  const owlChunkEnd = html.indexOf("</a>", owlIdx);
  const owlChunk = html.slice(owlIdx, owlChunkEnd);
  const newLogoBase64 = readFileSync(LOGO_PATH).toString("base64");
  const imgSrcRegex = /(<img[^>]*\bsrc=")data:image\/[a-zA-Z+]+;base64,[^"]*(")/;
  if (!imgSrcRegex.test(owlChunk)) throw new Error("Owl's Nest <img> src not found in chunk");
  const newOwlChunk = owlChunk.replace(imgSrcRegex, `$1data:image/png;base64,${newLogoBase64}$2`);
  html = html.slice(0, owlIdx) + newOwlChunk + html.slice(owlChunkEnd);
  console.log("✓ Owl's Nest logo swapped in.");

  // 2. Adorn logo 25% bigger (150x200 -> 188x250)
  const adornMarker = 'href="/adorn"';
  const adornIdx = html.indexOf(adornMarker);
  if (adornIdx === -1) throw new Error("Adorn anchor not found");
  const adornChunkEnd = html.indexOf("</a>", adornIdx);
  const adornChunk = html.slice(adornIdx, adornChunkEnd);
  const oldStyle = 'style="max-height:150px;max-width:200px"';
  if (!adornChunk.includes(oldStyle)) throw new Error("Adorn logo inline style not found as expected");
  const newAdornChunk = adornChunk.replace(oldStyle, 'style="max-height:188px;max-width:250px"');
  html = html.slice(0, adornIdx) + newAdornChunk + html.slice(adornChunkEnd);
  console.log("✓ Adorn logo resized to 25% bigger.");

  // 3. Footer "All rights reserved" link — inherit the footer's own dim color instead of browser-default blue
  const footerRuleMarker = ".footer-copy{";
  const footerRuleIdx = html.indexOf(footerRuleMarker);
  if (footerRuleIdx === -1) throw new Error(".footer-copy CSS rule not found");
  const footerRuleEnd = html.indexOf("}", footerRuleIdx) + 1;
  if (!html.includes(".footer-copy a{")) {
    html = html.slice(0, footerRuleEnd) + ".footer-copy a{color:inherit}" + html.slice(footerRuleEnd);
    console.log("✓ Footer link color fixed (no longer blue).");
  } else {
    console.log("• .footer-copy a rule already present, skipped.");
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
