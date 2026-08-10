import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MUSIC_PAGE_ID = "55c94675-3fef-48dd-9bf5-953ae8c9c9b9";

const OLD_ATTR = `data-sage-form-title="Musical Audience Form" class="audience-form"`;
const NEW_ATTR = `data-sage-form-title="Musical Audience Form" data-sage-form-thanks="Thanks! you are on the list." class="audience-form"`;

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", MUSIC_PAGE_ID)
    .single();

  if (error || !page) throw error ?? new Error("page not found");

  const html: string = page.html_content;
  if (!html.includes(OLD_ATTR)) throw new Error("anchor not found — page may have changed");

  const updated = html.replace(OLD_ATTR, NEW_ATTR);

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: updated })
    .eq("id", MUSIC_PAGE_ID);

  if (updateError) throw updateError;
  console.log("Music page thank-you message updated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
