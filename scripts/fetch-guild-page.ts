import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually
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

async function main() {
  const { data: sites } = await supabase
    .from("artist_sites")
    .select("id, slug, name, custom_domain")
    .eq("custom_domain", "willsage.com");

  console.log("Sites with willsage.com:", JSON.stringify(sites, null, 2));

  if (!sites || sites.length === 0) {
    // Try by slug
    const { data: allSites } = await supabase
      .from("artist_sites")
      .select("id, slug, name, custom_domain")
      .limit(20);
    console.log("All sites:", JSON.stringify(allSites, null, 2));
    return;
  }

  const siteId = sites[0].id;

  const { data: pages } = await supabase
    .from("site_pages")
    .select("id, slug, title, page_type, status, page_data")
    .eq("site_id", siteId);

  console.log("\nPages for this site:");
  pages?.forEach(p => {
    console.log(`  - ${p.slug} (${p.status}): ${p.title}`);
  });

  const guildPage = pages?.find(p => p.slug === "the-guild");
  if (guildPage) {
    console.log("\nGuild page_data:");
    console.log(JSON.stringify(guildPage.page_data, null, 2));
  } else {
    console.log("\nNo guild page found. All page slugs:", pages?.map(p => p.slug));
  }
}

main().catch(console.error);
