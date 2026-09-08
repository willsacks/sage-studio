/**
 * Fixes a bug from the previous logo-resize pass: sharp's automatic .trim()
 * was slightly too aggressive on New Earth Design Collective's faint/light
 * line-art logo, clipping the very top of its circle. Replaces all 5 logos
 * with a precisely-cropped version (own pixel bounding-box scan, alpha>0,
 * no heuristic threshold — verified by eye against the originals). Also
 * makes Murphy Maude's logo a bit smaller (circle 55px instead of 72px,
 * matching a smaller overall footprint) since its wordmark text was reading
 * much larger than the other 4 cards even at equal circle size. .logo-wrap
 * shrinks from 131px to 117px to match the new tallest logo (Adorn, 116.1px).
 * All logos stay flush at the top of their box (top:0, no empty space above).
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-logos-precise-crop.ts
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

const LOGOS = [
  { anchorMarker: 'href="https://www.newearthdesigncollective.com/"', file: "nedc", width: 87.4, height: 103.2 },
  { anchorMarker: 'href="https://murphymaude.com/" class="entity-card"', file: "murphymaude", width: 124.3, height: 102.2 },
  { anchorMarker: 'href="/adorn"', file: "adorn", width: 96.6, height: 116.1 },
  { anchorMarker: 'href="https://murphymaude.com/mableoriginals/"', file: "mable", width: 73.6, height: 88.7 },
  { anchorMarker: 'href="https://www.theowlsnestfarmandshop.com/"', file: "owlsnest", width: 73, height: 98.1 },
];

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  const oldLogoWrapRule = ".logo-wrap{height:131px;display:flex;align-items:center;justify-content:center;width:100%;position:relative}";
  if (!html.includes(oldLogoWrapRule)) throw new Error(".logo-wrap CSS rule not found as expected");
  html = html.replace(oldLogoWrapRule, ".logo-wrap{height:117px;display:flex;align-items:center;justify-content:center;width:100%;position:relative}");
  console.log("✓ .logo-wrap resized to fit new tallest logo (131px -> 117px).");

  for (const { anchorMarker, file, width, height } of LOGOS) {
    const idx = html.indexOf(anchorMarker);
    if (idx === -1) throw new Error(`Anchor not found: ${anchorMarker}`);
    const chunkEnd = html.indexOf("</a>", idx);
    const chunk = html.slice(idx, chunkEnd);
    const imgRegex = /<img\s+style="[^"]*"\s+src="data:image\/[a-zA-Z+]+;base64,[^"]*"/;
    if (!imgRegex.test(chunk)) throw new Error(`<img> not found in chunk for ${anchorMarker}`);
    const newBase64 = readFileSync(`/tmp/precise-${file}-b64.txt`, "utf-8").trim();
    const style = `position:absolute;left:50%;top:0;transform:translateX(-50%);width:${width}px;height:${height}px;max-width:none;max-height:none`;
    const newImgTag = `<img style="${style}" src="data:image/png;base64,${newBase64}"`;
    const newChunk = chunk.replace(imgRegex, newImgTag);
    if (newChunk === chunk) {
      console.log(`• No change needed for anchor (already identical): ${anchorMarker}`);
      continue;
    }
    html = html.slice(0, idx) + newChunk + html.slice(chunkEnd);
    console.log(`✓ Precise-cropped logo applied for anchor: ${anchorMarker}`);
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
