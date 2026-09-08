/**
 * Three more tweaks to Leslie Murphy's home page (lesliemurphy.com):
 *  1. Fix the 5 "brand" entity-cards no longer being equal width — a classic
 *     CSS grid blowout: making the Adorn logo's max-width bigger gave that
 *     grid item a larger min-content size than its 1fr siblings, so its
 *     track grew. Adding min-width:0 to .entity-card lets the grid's equal
 *     1fr tracks win again, and the (already object-fit:contain'd) image
 *     just scales down to fit instead of stretching its column.
 *  2. Remove the underline from the "All rights reserved" footer link (a
 *     deliberately low-key link to the studio login) so it reads as plain
 *     text, not a link.
 *  3. Add an "Other" option to the contact form's "What brings you here?" select.
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-cards-footer-form.ts
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

  // 1. Grid blowout fix
  const oldEntityCardRule = ".entity-card{background:rgba(255,255,255,.04);border:1px solid rgba(184,147,90,.25);padding:40px 24px 32px;text-decoration:none;display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;transition:background .25s,border-color .25s}";
  if (!html.includes(oldEntityCardRule)) throw new Error(".entity-card CSS rule not found as expected");
  const newEntityCardRule = oldEntityCardRule.replace("gap:16px;", "gap:16px;min-width:0;");
  html = html.replace(oldEntityCardRule, newEntityCardRule);
  console.log("✓ Entity cards will size equally again (min-width:0 added).");

  // 2. Footer link: remove underline (already color:inherit from the earlier fix)
  const oldFooterLinkRule = ".footer-copy a{color:inherit}";
  if (!html.includes(oldFooterLinkRule)) throw new Error(".footer-copy a rule not found as expected");
  html = html.replace(oldFooterLinkRule, ".footer-copy a{color:inherit;text-decoration:none}");
  console.log("✓ Footer link underline removed.");

  // 3. Add "Other" option to the contact form select
  const oldOption = "<option>Collaboration or Speaking</option>";
  if (!html.includes(oldOption)) throw new Error("'Collaboration or Speaking' option not found as expected");
  if (!html.includes("<option>Other</option>")) {
    html = html.replace(oldOption, `${oldOption}\n        <option>Other</option>`);
    console.log('✓ "Other" option added to the contact form.');
  } else {
    console.log('• "Other" option already present, skipped.');
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;
  console.log("✓ Saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
