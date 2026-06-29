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
-- Returns the caller's effective rank on a site: 3 = owner, 2 = manager,
-- 1 = editor, 0 = viewer, -1 = no access. SECURITY DEFINER so it bypasses
-- RLS internally (avoids recursive policy evaluation on either table).
CREATE OR REPLACE FUNCTION public.user_site_role_rank(p_site_id uuid, p_user_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.artist_sites s WHERE s.id = p_site_id AND s.user_id = p_user_id) THEN 3
    ELSE COALESCE((
      SELECT CASE c.role WHEN 'manager' THEN 2 WHEN 'editor' THEN 1 WHEN 'viewer' THEN 0 END
      FROM public.site_collaborators c
      WHERE c.site_id = p_site_id AND c.user_id = p_user_id AND c.status = 'accepted'
      LIMIT 1
    ), -1)
  END;
$$;

DROP POLICY IF EXISTS "artist_sites_select" ON public.artist_sites;
CREATE POLICY "artist_sites_select" ON public.artist_sites FOR SELECT
  USING (is_published = true OR public.user_site_role_rank(id, auth.uid()) >= 0);

DROP POLICY IF EXISTS "artist_sites_update" ON public.artist_sites;
CREATE POLICY "artist_sites_update" ON public.artist_sites FOR UPDATE
  USING (public.user_site_role_rank(id, auth.uid()) >= 1);

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
