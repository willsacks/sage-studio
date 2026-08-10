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

const HOME_PAGE_ID = "d48487da-7987-4746-b302-28a2ed31bf43";

const OLD = `<p class="sub">Rooted River weaves together diverse tributaries that invite us into deeper embodiment, authentic relationship, creative expression, and reverent participation in the unfolding of life.&nbsp;<div><br></div><div>No matter the route you take, our approach is grounded in cultivating inner awareness and stability first. Next comes an opening to life through integrative practices. And finally a full reclamation of self and your agency in the greater world.</div></p><div><br></div><div><br></div><p></p>`;

const NEW = `<p class="sub">Rooted River weaves together diverse tributaries that invite us into deeper embodiment, authentic relationship, creative expression, and reverent participation in the unfolding of life.&nbsp;<br><br>No matter the route you take, our approach is grounded in cultivating inner awareness and stability first. Next comes an opening to life through integrative practices. And finally a full reclamation of self and your agency in the greater world.</p>`;

async function main() {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", HOME_PAGE_ID)
    .single();
  if (error || !page) throw error ?? new Error("page not found");

  const html: string = page.html_content;
  if (!html.includes(OLD)) throw new Error("anchor not found — page may have changed");

  const updated = html.replace(OLD, NEW);

  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: updated })
    .eq("id", HOME_PAGE_ID);
  if (updateError) throw updateError;
  console.log("Home page 'balance' paragraph fixed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
