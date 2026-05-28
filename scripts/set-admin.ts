/**
 * Sets a user as platform admin with studio_pro tier.
 * Run: cd sage-studio && npx tsx scripts/set-admin.ts
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

const TARGET_EMAIL = "will@creatorscircle.art";

async function main() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const user = users.users.find((u) => u.email === TARGET_EMAIL);
  if (!user) throw new Error(`User ${TARGET_EMAIL} not found`);

  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin", tier_key: "studio_pro" })
    .eq("id", user.id);

  if (error) throw error;
  console.log(`✓ ${TARGET_EMAIL} (${user.id}) is now role=admin, tier_key=studio_pro`);
}

main().catch((err) => { console.error(err); process.exit(1); });
