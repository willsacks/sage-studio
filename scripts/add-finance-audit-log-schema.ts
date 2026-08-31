/**
 * Adds a log of who created/edited/deleted what in the ledger. A bookkeeper
 * collaborating on someone else's books (or the owner reviewing a
 * bookkeeper's work) has had no way to answer "why did this change" —
 * everything up to now was either silent or, at best, visible only as the
 * current state of a row with no history of who touched it or when.
 *
 * Run: cd sage-studio && npx tsx scripts/add-finance-audit-log-schema.ts
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQL = `
CREATE TABLE IF NOT EXISTS public.finance_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  actor_id      uuid        NOT NULL REFERENCES public.profiles(id),
  action        text        NOT NULL,
  target_table  text        NOT NULL,
  target_id     uuid,
  diff          jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_log_entity ON public.finance_audit_log (entity_id, created_at DESC);

ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view their entity's audit log" ON public.finance_audit_log;
CREATE POLICY "Members view their entity's audit log"
  ON public.finance_audit_log FOR SELECT
  USING (public.is_finance_entity_member(entity_id, auth.uid()));

-- Inserts only ever happen server-side via the service-role-free request
-- client (same auth context as every other write in this module), so the
-- WITH CHECK mirrors the editor-or-above bar every mutating action already
-- enforces in code — this is a backstop, not the primary gate.
DROP POLICY IF EXISTS "Editors can log audit entries" ON public.finance_audit_log;
CREATE POLICY "Editors can log audit entries"
  ON public.finance_audit_log FOR INSERT
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor') AND actor_id = auth.uid());
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ finance_audit_log table added.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
