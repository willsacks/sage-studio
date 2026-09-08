/**
 * Replaces each of the 5 brand-partner logo images on Leslie Murphy's home
 * page with an auto-trimmed version (transparent padding removed via
 * sharp .trim(), no visible content lost — verified by eye beforehand), then
 * resizes all 5 to a uniform 72px circle diameter (50% bigger than the
 * previous 48px) using the same measure-then-position approach as
 * scripts/fix-leslie-murphy-logo-circles.ts. Trimming first is what makes the
 * 50% increase possible without widening the cards — Adorn's untrimmed file
 * was mostly empty margin, so trimmed it needs far less width for the same
 * circle size. .logo-wrap grows 145px -> 195px tall to fit (card width is
 * untouched, per instruction — only height may grow).
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-logos-trim-and-bigger.ts
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
  { anchorMarker: 'href="https://www.newearthdesigncollective.com/"', file: "nedc", style: "position:absolute;left:50%;top:74.8px;transform:translateX(-50%);width:87px;height:90.1px" },
  { anchorMarker: 'href="https://murphymaude.com/" class="entity-card"', file: "murphymaude", style: "position:absolute;left:50%;top:61.9px;transform:translateX(-50%);width:159.7px;height:130.7px" },
  { anchorMarker: 'href="/adorn"', file: "adorn", style: "position:absolute;left:50%;top:61.8px;transform:translateX(-50%);width:93.4px;height:109px" },
  { anchorMarker: 'href="https://murphymaude.com/mableoriginals/"', file: "mable", style: "position:absolute;left:50%;top:61.9px;transform:translateX(-50%);width:72px;height:86.8px" },
  { anchorMarker: 'href="https://www.theowlsnestfarmandshop.com/"', file: "owlsnest", style: "position:absolute;left:50%;top:61.5px;transform:translateX(-50%);width:73px;height:98.1px" },
];

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  let html = page.html_content as string;

  const oldLogoWrapRule = ".logo-wrap{height:145px;display:flex;align-items:center;justify-content:center;width:100%;position:relative}";
  if (!html.includes(oldLogoWrapRule)) throw new Error(".logo-wrap CSS rule not found as expected");
  html = html.replace(oldLogoWrapRule, ".logo-wrap{height:195px;display:flex;align-items:center;justify-content:center;width:100%;position:relative}");
  console.log("✓ .logo-wrap grown to fit bigger trimmed logos (145px -> 195px). Card width untouched.");

  for (const { anchorMarker, file, style } of LOGOS) {
    const idx = html.indexOf(anchorMarker);
    if (idx === -1) throw new Error(`Anchor not found: ${anchorMarker}`);
    const chunkEnd = html.indexOf("</a>", idx);
    const chunk = html.slice(idx, chunkEnd);
    const imgRegex = /<img(?:\s+style="[^"]*")?\s+src="data:image\/[a-zA-Z+]+;base64,[^"]*"/;
    if (!imgRegex.test(chunk)) throw new Error(`<img> not found in chunk for ${anchorMarker}`);
    const newBase64 = readFileSync(`/tmp/logo2-${file}-b64.txt`, "utf-8").trim();
    const newImgTag = `<img style="${style}" src="data:image/png;base64,${newBase64}"`;
    const newChunk = chunk.replace(imgRegex, newImgTag);
    if (newChunk === chunk) throw new Error(`No change applied for ${anchorMarker}`);
    html = html.slice(0, idx) + newChunk + html.slice(chunkEnd);
    console.log(`✓ Logo trimmed + resized 50% bigger for anchor: ${anchorMarker}`);
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
