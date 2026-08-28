/**
 * Extends the Finances module with:
 * - Email-based collaborator invites on finance_entity_members (same
 *   invite_token pattern as site_collaborators), so an owner can share a
 *   book of accounts with e.g. a bookkeeper.
 * - A "needs review" flag on transactions so a bookkeeper (editor role)
 *   can flag ambiguous transactions with a note for the owner to resolve,
 *   plus a money_account_id fallback for categorizing transactions that
 *   aren't tied to a Plaid-linked bank_accounts row (CSV-imported ones).
 *
 * Run: cd sage-studio && npx tsx scripts/add-finances-collaborators-review-schema.ts
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
-- ============================================================
-- Finance entity collaborator invites (mirrors site_collaborators)
-- ============================================================
ALTER TABLE public.finance_entity_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.finance_entity_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.finance_entity_members ADD COLUMN IF NOT EXISTS invite_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');
ALTER TABLE public.finance_entity_members ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.finance_entity_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.finance_entity_members ALTER COLUMN status SET DEFAULT 'pending';

DO $$ BEGIN
  ALTER TABLE public.finance_entity_members ADD CONSTRAINT finance_entity_members_entity_email_key UNIQUE (entity_id, email);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Needs-review workflow + CSV-import money account fallback
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS flagged_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS flagged_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS money_account_id uuid REFERENCES public.chart_of_accounts(id);

CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON public.transactions(entity_id, needs_review) WHERE needs_review = true;
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql unavailable: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ Finances collaborators/review schema applied.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
