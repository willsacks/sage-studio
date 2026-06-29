/**
 * Creates the site_collaborators table for multi-user site sharing.
 * Run: cd sage-studio && npx tsx scripts/add-site-collaborators-table.ts
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

const SQL = `
CREATE TABLE IF NOT EXISTS public.site_collaborators (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid        NOT NULL REFERENCES public.artist_sites(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('viewer','editor','manager')),
  invite_token text       NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  invited_by  uuid        NOT NULL REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, email)
);

CREATE INDEX IF NOT EXISTS idx_site_collaborators_site ON public.site_collaborators(site_id);
CREATE INDEX IF NOT EXISTS idx_site_collaborators_user ON public.site_collaborators(user_id);
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);

  if (error) {
    // Fallback: probe whether the table already exists
    const { error: e2 } = await supabase.from("site_collaborators").select("id").limit(1);
    if (e2?.message?.includes("does not exist") || e2?.code === "PGRST205") {
      console.error("Table does not exist and could not be created via RPC.");
      console.log("Run this SQL manually in the Supabase dashboard SQL editor:\n");
      console.log(SQL);
      process.exit(1);
    } else {
      console.log("✓ site_collaborators table already exists (or was created successfully).");
    }
  } else {
    console.log("✓ site_collaborators table created.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
