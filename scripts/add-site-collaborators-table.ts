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

-- RLS: this table grants access, so it's locked down even though artist_sites/site_pages
-- aren't (the anon key is public; without this, anyone could grant themselves access
-- directly via the REST API, bypassing the app's permission checks entirely).
ALTER TABLE public.site_collaborators ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so the "is this user a manager of this site" check bypasses RLS
-- internally instead of re-triggering the policy below on itself (infinite recursion).
CREATE OR REPLACE FUNCTION public.is_site_manager(p_site_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_collaborators
    WHERE site_id = p_site_id AND user_id = p_user_id AND role = 'manager' AND status = 'accepted'
  );
$$;

DROP POLICY IF EXISTS "Owners and managers manage collaborators" ON public.site_collaborators;
CREATE POLICY "Owners and managers manage collaborators" ON public.site_collaborators
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.artist_sites s WHERE s.id = site_collaborators.site_id AND s.user_id = auth.uid())
    OR public.is_site_manager(site_collaborators.site_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_sites s WHERE s.id = site_collaborators.site_id AND s.user_id = auth.uid())
    OR public.is_site_manager(site_collaborators.site_id, auth.uid())
  );

DROP POLICY IF EXISTS "Collaborators can view their own row" ON public.site_collaborators;
CREATE POLICY "Collaborators can view their own row" ON public.site_collaborators
  FOR SELECT
  USING (user_id = auth.uid());
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
