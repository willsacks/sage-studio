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

const OLD_CSS =
  `  .placeholder-section p{ font-size:15px; color:var(--muted); font-weight:300; max-width:480px; margin:0 auto;}\n</style>`;

const NEW_CSS =
  `  .placeholder-section p{ font-size:15px; color:var(--muted); font-weight:300; max-width:480px; margin:0 auto;}

  .audience-form{ max-width:420px; margin:36px auto 0; text-align:left;}
  .audience-form .field{ margin-bottom:24px;}
  .audience-form label{ display:block; font-size:12.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin-bottom:8px;}
  .audience-form input{ width:100%; padding:14px 16px; font-family:'Jost',sans-serif; font-size:15px; font-weight:300; color:var(--charcoal); background:#fff; border:1px solid var(--hair); border-radius:2px; box-sizing:border-box;}
  .audience-form input:focus{ outline:none; border-color:var(--tan-line);}
  .audience-form-actions{ text-align:center;}
  .audience-form button.pill{ font-family:'Jost',sans-serif; margin-top:8px;}
</style>`;

const OLD_SECTION =
  `<section class="placeholder-section">
  <div class="wrap">
    <h1>Music</h1>
    <p>We are currently producing our first musical offering. Please enter your email below to be notified when it's ready and to follow along :)</p>
  </div>
</section>`;

const NEW_SECTION =
  `<section class="placeholder-section">
  <div class="wrap">
    <h1>Music</h1>
    <p>We are currently producing our first musical offering. Please enter your email below to be notified when it's ready and to follow along :)</p>
    <form data-sage-form="true" data-sage-form-title="Musical Audience Form" class="audience-form">
      <div class="field">
        <label for="af-name">Name</label>
        <input type="text" id="af-name" name="name" required>
      </div>
      <div class="field">
        <label for="af-email">Email</label>
        <input type="email" id="af-email" name="email" required>
      </div>
      <div class="audience-form-actions">
        <button type="submit" class="pill">Keep Me Posted</button>
      </div>
    </form>
  </div>
</section>`;

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", MUSIC_PAGE_ID)
    .single();

  if (error || !page) throw error ?? new Error("page not found");

  const html: string = page.html_content;

  if (!html.includes(OLD_CSS)) throw new Error("CSS anchor not found — page may have changed");
  if (!html.includes(OLD_SECTION)) throw new Error("Section anchor not found — page may have changed");

  const updated = html.replace(OLD_CSS, NEW_CSS).replace(OLD_SECTION, NEW_SECTION);

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: updated })
    .eq("id", MUSIC_PAGE_ID);

  if (updateError) throw updateError;

  console.log("Music page updated successfully.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
