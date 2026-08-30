/**
 * Adds a durable log of each AI categorization assistant run. Before this,
 * the only signal for what happened during a run was the live NDJSON stream
 * sent straight to the browser — nothing survived past that request, so a
 * report like "it started working, then stopped responding" was
 * undiagnosable after the fact (no server-side trace to go check). This
 * table gets a row per run, updated as the turn loop progresses, so even a
 * run that genuinely hangs mid-turn leaves behind how far it got.
 *
 * Run: cd sage-studio && npx tsx scripts/add-finance-ai-run-log-schema.ts
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
CREATE TABLE IF NOT EXISTS public.finance_ai_categorize_runs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.finance_entities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  turns integer not null default 0,
  stop_reason text,
  status text not null default 'running' check (status in ('running','completed','error')),
  error text,
  actions_taken integer not null default 0
);

CREATE INDEX IF NOT EXISTS finance_ai_categorize_runs_started_at_idx
  ON public.finance_ai_categorize_runs (started_at DESC);

ALTER TABLE public.finance_ai_categorize_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own AI run logs" ON public.finance_ai_categorize_runs;
CREATE POLICY "Users manage their own AI run logs"
  ON public.finance_ai_categorize_runs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ finance_ai_categorize_runs table added.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
