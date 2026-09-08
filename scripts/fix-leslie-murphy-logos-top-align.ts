/**
 * Moves the 5 brand-partner logos to the top of their .logo-wrap box (top:0
 * instead of the ~62-75px offset used to align circle centers), removing the
 * empty space above each logo, then shrinks .logo-wrap to fit the tallest
 * logo (Murphy Maude, 130.7px) so the box doesn't carry that same wasted
 * space at the bottom either.
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-logos-top-align.ts
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

  const oldLogoWrapRule = ".logo-wrap{height:195px;display:flex;align-items:center;justify-content:center;width:100%;position:relative}";
  if (!html.includes(oldLogoWrapRule)) throw new Error(".logo-wrap CSS rule not found as expected");
  html = html.replace(oldLogoWrapRule, ".logo-wrap{height:131px;display:flex;align-items:center;justify-content:center;width:100%;position:relative}");
  console.log("✓ .logo-wrap shrunk to fit tightest around the tallest logo (195px -> 131px).");

  const beforeCount = (html.match(/top:[0-9.]+px;transform:translateX\(-50%\)/g) || []).length;
  html = html.replace(/top:[0-9.]+px;transform:translateX\(-50%\)/g, "top:0;transform:translateX(-50%)");
  const afterCount = (html.match(/top:0;transform:translateX\(-50%\)/g) || []).length;
  console.log(`✓ Top offsets removed on ${afterCount}/${beforeCount} logos (all now flush to the top of their box).`);
  if (afterCount !== 5) throw new Error(`Expected 5 logos updated, got ${afterCount}`);

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
