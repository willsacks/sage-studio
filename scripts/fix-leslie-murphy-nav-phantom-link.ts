/**
 * Removes two pieces of empty debris stuck in the nav wordmark — an
 * invisible "little blue box" the site owner could see but not select or
 * delete. Created by a since-fixed bug in HtmlVisualEditor.tsx: placing a
 * cursor in editable text with nothing highlighted, then applying a link
 * (or a text color), ran execCommand("createLink"/"foreColor") on a
 * collapsed selection. WebKit turned that into a new empty element at the
 * cursor position; for the link case it also bled the editor's own
 * [contenteditable]:focus outline color (#6366f1) onto it as an inline
 * style. The link's href is the Sage Studio editor's own admin URL for this
 * page — apparently pasted in by mistake; not something the code fix needs
 * to prevent, but the empty unrecoverable element it produced is.
 * Run: cd sage-studio && npx tsx scripts/fix-leslie-murphy-nav-phantom-link.ts
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

// The phantom link — "the little blue box" itself, the one the site owner
// reported.
const PHANTOM_ANCHOR =
  '<a href="https://sagestudio.org/my-site/d27f2194-dff9-4e8c-892f-199f3fd60c2f/pages/0524e4b0-72d4-4d22-81fc-a7bb508a605d/edit#home" class="nav-wordmark" style="outline: rgb(99, 102, 241) solid 2px; outline-offset: 2px;"><br></a>';

// Adjacent debris from the same editing session (the applyColor sibling bug)
// — invisible (no outline), but dead weight in the DOM. Cleaned up alongside
// since it's the same root cause, found during the same investigation.
const PHANTOM_SPAN = '&nbsp;&nbsp;<span style="color: rgb(28, 20, 10);"><br></span>';

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", PAGE_ID)
    .single();
  if (error) throw error;
  const html = page.html_content as string;

  const anchorOccurrences = html.split(PHANTOM_ANCHOR).length - 1;
  if (anchorOccurrences !== 1) {
    throw new Error(`Expected exactly 1 occurrence of the phantom anchor, found ${anchorOccurrences}. Aborting.`);
  }
  const spanOccurrences = html.split(PHANTOM_SPAN).length - 1;
  if (spanOccurrences !== 1) {
    throw new Error(`Expected exactly 1 occurrence of the phantom span, found ${spanOccurrences}. Aborting.`);
  }

  const cleaned = html.replace(PHANTOM_ANCHOR, "").replace(PHANTOM_SPAN, "");
  const expectedLength = html.length - PHANTOM_ANCHOR.length - PHANTOM_SPAN.length;
  if (cleaned.length !== expectedLength) {
    throw new Error(`Length mismatch after replace: got ${cleaned.length}, expected ${expectedLength}. Aborting without writing.`);
  }

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: cleaned, updated_at: new Date().toISOString() })
    .eq("id", PAGE_ID);
  if (updateError) throw updateError;

  console.log(`✓ Removed phantom <a> anchor (${PHANTOM_ANCHOR.length} chars) and phantom <span> (${PHANTOM_SPAN.length} chars).`);
  console.log(`  New length: ${cleaned.length} (was ${html.length}).`);
  console.log("  status left untouched (still draft) — republish manually once reviewed.");
}

main().catch((err) => { console.error(err); process.exit(1); });
