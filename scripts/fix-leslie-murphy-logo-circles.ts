/**
 * Makes the 5 brand-partner logo circles on Leslie Murphy's home page render
 * at the same size and align to the same horizontal line, despite each source
 * logo file having a wildly different canvas size and a different amount of
 * wordmark/decoration around its circle mark. Measurements (circle diameter,
 * circle center position, natural image size) were taken by pixel-scanning
 * each logo's alpha channel to find its circular ring's true diameter and
 * vertical center — see the (offline) analysis this script's constants come
 * from. Each <img> gets an explicit absolute-positioned size/offset so its
 * circle lands at the same diameter and Y position; .logo-wrap grows from
 * 120px to 145px tall to fit the tallest resulting image without clipping.
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-logo-circles.ts
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

// anchorMarker identifies each card; style is the exact inline style to set on its <img>.
const LOGOS = [
  { anchorMarker: 'href="https://www.newearthdesigncollective.com/"', style: "position:absolute;left:50%;top:44.5px;transform:translateX(-50%);width:71.9px;height:74.7px" },
  { anchorMarker: 'href="https://murphymaude.com/" class="entity-card"', style: "position:absolute;left:50%;top:42.5px;transform:translateX(-50%);width:125.2px;height:100.2px" },
  { anchorMarker: 'href="/adorn"', style: "position:absolute;left:50%;top:33.1px;transform:translateX(-50%);width:153.5px;height:103.8px" },
  { anchorMarker: 'href="https://murphymaude.com/mableoriginals/"', style: "position:absolute;left:50%;top:44.3px;transform:translateX(-50%);width:62.3px;height:63.3px" },
  { anchorMarker: 'href="https://www.theowlsnestfarmandshop.com/"', style: "position:absolute;left:50%;top:46.8px;transform:translateX(-50%);width:68.8px;height:68.8px" },
];

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  // .logo-wrap needs position:relative (for the absolutely-positioned img) and
  // a taller box (120px -> 145px) to fit the tallest rescaled logo.
  const oldLogoWrapRule = ".logo-wrap{height:120px;display:flex;align-items:center;justify-content:center;width:100%}";
  if (!html.includes(oldLogoWrapRule)) throw new Error(".logo-wrap CSS rule not found as expected");
  html = html.replace(oldLogoWrapRule, ".logo-wrap{height:145px;display:flex;align-items:center;justify-content:center;width:100%;position:relative}");
  console.log("✓ .logo-wrap resized to 145px and made a positioning context.");

  for (const { anchorMarker, style } of LOGOS) {
    const idx = html.indexOf(anchorMarker);
    if (idx === -1) throw new Error(`Anchor not found: ${anchorMarker}`);
    const chunkEnd = html.indexOf("</a>", idx);
    const chunk = html.slice(idx, chunkEnd);
    const imgRegex = /<img([^>]*?)(?:\s+style="[^"]*")?(\s+src="data:image\/[a-zA-Z+]+;base64,[^"]*")/;
    if (!imgRegex.test(chunk)) throw new Error(`<img> not found in chunk for ${anchorMarker}`);
    const newChunk = chunk.replace(imgRegex, (_match, beforeAttrs, srcAttr) => {
      // Strip any pre-existing style="..." from beforeAttrs (e.g. Adorn's old inline size).
      const cleanedBefore = beforeAttrs.replace(/\s+style="[^"]*"/, "");
      return `<img${cleanedBefore} style="${style}"${srcAttr}`;
    });
    if (newChunk === chunk) throw new Error(`No change applied for ${anchorMarker}`);
    html = html.slice(0, idx) + newChunk + html.slice(chunkEnd);
    console.log(`✓ Logo sized/positioned for anchor: ${anchorMarker}`);
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
