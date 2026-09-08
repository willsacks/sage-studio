/**
 * Backfills duration_seconds for any time_entries where it is 0 or null
 * but stopped_at > started_at (the timestamps are correct, just the cached
 * duration column is wrong).
 *
 * Run: cd sage-studio && npx tsx scripts/fix-zero-duration-entries.ts
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

async function main() {
  // Find affected entries
  const { data: entries, error: fetchErr } = await supabase
    .from("time_entries")
    .select("id, started_at, stopped_at, duration_seconds")
    .not("stopped_at", "is", null)
    .or("duration_seconds.is.null,duration_seconds.eq.0");

  if (fetchErr) { console.error("Fetch error:", fetchErr.message); process.exit(1); }

  const toFix = (entries ?? []).filter((e) => {
    const start = new Date(e.started_at).getTime();
    const stop = new Date(e.stopped_at!).getTime();
    return stop > start;
  });

  if (toFix.length === 0) {
    console.log("✓ No entries need fixing.");
    return;
  }

  console.log(`Found ${toFix.length} entries to fix:`);
  for (const e of toFix) {
    const computed = Math.floor(
      (new Date(e.stopped_at!).getTime() - new Date(e.started_at).getTime()) / 1000
    );
    console.log(`  ${e.id}  ${e.started_at} → ${e.stopped_at}  was: ${e.duration_seconds}  fix: ${computed}s`);
    const { error: updErr } = await supabase
      .from("time_entries")
      .update({ duration_seconds: computed })
      .eq("id", e.id);
    if (updErr) console.error(`  ✗ failed: ${updErr.message}`);
    else console.log(`  ✓ fixed`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
