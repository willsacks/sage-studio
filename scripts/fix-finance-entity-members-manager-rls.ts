/**
 * Bug fix: the "Owners manage entity members" RLS policy on
 * finance_entity_members only allowed the literal finance_entities.owner_id,
 * even though the app layer (lib/actions/finance-collaborators.ts) already
 * treats any "manager"-role collaborator as authorized to invite/re-role/
 * remove other collaborators, and the SELECT policy only let a collaborator
 * see their own row, not the full roster. Adds an is_finance_entity_manager
 * SECURITY DEFINER helper (mirrors is_site_manager for site_collaborators)
 * and widens both policies to match the app's actual authorization model.
 *
 * Run: cd sage-studio && npx tsx scripts/fix-finance-entity-members-manager-rls.ts
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
CREATE OR REPLACE FUNCTION public.is_finance_entity_manager(p_entity_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.finance_entity_members
    WHERE entity_id = p_entity_id AND user_id = p_user_id AND role = 'manager' AND status = 'accepted'
  );
$$;

DROP POLICY IF EXISTS "Owners manage entity members" ON public.finance_entity_members;
CREATE POLICY "Owners manage entity members" ON public.finance_entity_members
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.finance_entities e WHERE e.id = entity_id AND e.owner_id = auth.uid())
    OR public.is_finance_entity_manager(entity_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.finance_entities e WHERE e.id = entity_id AND e.owner_id = auth.uid())
    OR public.is_finance_entity_manager(entity_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members view their own membership" ON public.finance_entity_members;
CREATE POLICY "Members view their own membership" ON public.finance_entity_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.finance_entities e WHERE e.id = entity_id AND e.owner_id = auth.uid())
    OR public.is_finance_entity_manager(entity_id, auth.uid())
  );
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql unavailable: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ finance_entity_members manager RLS fix applied.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
