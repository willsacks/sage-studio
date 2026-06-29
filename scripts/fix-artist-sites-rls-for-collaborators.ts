/**
 * artist_sites and site_pages have pre-existing owner-only RLS policies
 * (user_id = auth.uid()) that predate the site_collaborators feature. They
 * silently block every write from a collaborator (and every read of an
 * unpublished site/page), since the app's own permission checks pass but
 * the database still denies the row.
 *
 * Run: cd sage-studio && npx tsx scripts/fix-artist-sites-rls-for-collaborators.ts
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
-- Returns the caller's effective rank on a site via site_collaborators only
-- (3=owner is handled separately by a direct column check in the policies
-- below — see note at the bottom on why). Used by site_pages policies, where
-- the owner-check safely queries artist_sites (a different, pre-existing
-- table, not the one being written to).
CREATE OR REPLACE FUNCTION public.user_site_role_rank(p_site_id uuid, p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.artist_sites s WHERE s.id = p_site_id AND s.user_id = p_user_id) THEN
    RETURN 3;
  END IF;
  SELECT CASE c.role WHEN 'manager' THEN 2 WHEN 'editor' THEN 1 WHEN 'viewer' THEN 0 END INTO r
  FROM public.site_collaborators c
  WHERE c.site_id = p_site_id AND c.user_id = p_user_id AND c.status = 'accepted'
  LIMIT 1;
  RETURN COALESCE(r, -1);
END;
$$;

-- Collaborator-only check (never touches artist_sites). Needed because
-- a SELECT/UPDATE policy on artist_sites that re-queries artist_sites itself
-- (even via a SECURITY DEFINER function) fails to see a row inserted by the
-- SAME INSERT ... RETURNING statement — a real Postgres RLS limitation, not
-- a logic bug. Confirmed by direct testing: works fine one statement later in
-- the same transaction, fails only within the inserting statement itself.
-- The fix is to never have artist_sites' own policies query artist_sites —
-- owner is checked via a plain column comparison instead, and only the
-- collaborator fallback goes through this function (which queries a
-- different table, so it isn't subject to the same limitation).
CREATE OR REPLACE FUNCTION public.is_accepted_site_collaborator(p_site_id uuid, p_user_id uuid, p_min_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE found_role text;
BEGIN
  SELECT c.role INTO found_role FROM public.site_collaborators c
  WHERE c.site_id = p_site_id AND c.user_id = p_user_id AND c.status = 'accepted'
  LIMIT 1;
  IF found_role IS NULL THEN RETURN false; END IF;
  RETURN (CASE found_role WHEN 'manager' THEN 2 WHEN 'editor' THEN 1 WHEN 'viewer' THEN 0 END)
       >= (CASE p_min_role WHEN 'manager' THEN 2 WHEN 'editor' THEN 1 WHEN 'viewer' THEN 0 END);
END;
$$;

DROP POLICY IF EXISTS "artist_sites_select" ON public.artist_sites;
CREATE POLICY "artist_sites_select" ON public.artist_sites FOR SELECT
  USING (user_id = auth.uid() OR is_published = true OR public.is_accepted_site_collaborator(id, auth.uid()));

DROP POLICY IF EXISTS "artist_sites_update" ON public.artist_sites;
CREATE POLICY "artist_sites_update" ON public.artist_sites FOR UPDATE
  USING (user_id = auth.uid() OR public.is_accepted_site_collaborator(id, auth.uid(), 'editor'));

DROP POLICY IF EXISTS "site_pages_select" ON public.site_pages;
CREATE POLICY "site_pages_select" ON public.site_pages FOR SELECT
  USING (status = 'published' OR public.user_site_role_rank(site_id, auth.uid()) >= 0);

DROP POLICY IF EXISTS "site_pages_update" ON public.site_pages;
CREATE POLICY "site_pages_update" ON public.site_pages FOR UPDATE
  USING (public.user_site_role_rank(site_id, auth.uid()) >= 1);

DROP POLICY IF EXISTS "site_pages_insert" ON public.site_pages;
CREATE POLICY "site_pages_insert" ON public.site_pages FOR INSERT
  WITH CHECK (public.user_site_role_rank(site_id, auth.uid()) >= 1);

DROP POLICY IF EXISTS "site_pages_delete" ON public.site_pages;
CREATE POLICY "site_pages_delete" ON public.site_pages FOR DELETE
  USING (public.user_site_role_rank(site_id, auth.uid()) >= 1);

-- artist_sites_insert and artist_sites_delete are left untouched: site creation
-- and deletion both remain owner-only, matching the app's own rules.
-- site_pages policies are untouched too — their owner-check queries artist_sites
-- (a different, pre-existing table), so they were never subject to the
-- same-statement visibility limitation described above.
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error("Could not apply via RPC:", error.message);
    console.log("Run this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exit(1);
  }
  console.log("✓ RLS policies updated for collaborator access.");
}

main().catch((err) => { console.error(err); process.exit(1); });
