/**
 * Schema for importing historical books from QuickBooks Online (OAuth) and
 * Wave (CSV) into a brand-new Sage Studio finance entity. Adds a first-class
 * customers table (QuickBooks/Wave both track real contact info that the
 * existing free-text client_name columns would otherwise discard), QBO
 * connection storage, and a generic import_jobs table so a multi-phase,
 * possibly long-running migration can be tracked/resumed/polled.
 *
 * Run: cd sage-studio && npx tsx scripts/add-import-schema.ts
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
-- ============================================================
-- finance_customers — unified "external party" record (covers both
-- QuickBooks Customers and Vendors, and Wave customers) so imported contact
-- info (email/phone/address) isn't discarded into a free-text field.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_customers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  email        text,
  phone        text,
  address      text,
  external_id  text,
  source       text        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','quickbooks','wave')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_finance_customers_entity ON public.finance_customers(entity_id);

ALTER TABLE public.finance_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their finance customers" ON public.finance_customers;
CREATE POLICY "Members access their finance customers" ON public.finance_customers
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

-- Additive-only links from existing free-text client fields to a real
-- customer record. client_name/client_email stay authoritative for display
-- on both tables — manually-created invoices/projects never need a
-- customer_id, and existing UI/reports keep working unchanged.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.finance_customers(id) ON DELETE SET NULL;
ALTER TABLE public.finance_projects ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.finance_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_projects_customer ON public.finance_projects(customer_id);

-- ============================================================
-- qbo_connections — one per finance entity (never many-to-many like
-- Plaid's bank_connections): a QuickBooks connection only ever exists to
-- seed the one new entity it was created for.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qbo_connections (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                 uuid        NOT NULL UNIQUE REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  owner_id                  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qbo_realm_id              text        NOT NULL,
  access_token_encrypted    text        NOT NULL,
  refresh_token_encrypted   text        NOT NULL,
  access_token_expires_at   timestamptz NOT NULL,
  refresh_token_expires_at  timestamptz NOT NULL,
  environment               text        NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox','production')),
  status                    text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','error','revoked')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qbo_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their qbo connection" ON public.qbo_connections;
CREATE POLICY "Members access their qbo connection" ON public.qbo_connections
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

-- ============================================================
-- import_jobs — tracks a QuickBooks/Wave migration's progress so the UI can
-- poll it. Scoped to owner_id (not entity membership) since entity_id is
-- null for most of a job's early life, and an in-progress migration's
-- status/errors shouldn't be visible to a collaborator invited later.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_id         uuid        REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  source            text        NOT NULL CHECK (source IN ('quickbooks','wave')),
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  phase             text        NOT NULL DEFAULT 'staging',
  progress_current  int         NOT NULL DEFAULT 0,
  progress_total    int         NOT NULL DEFAULT 0,
  cursor_state      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  staged_data_path  text,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_owner ON public.import_jobs(owner_id);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners access their own import jobs" ON public.import_jobs;
CREATE POLICY "Owners access their own import jobs" ON public.import_jobs
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Distinguish imported raw journal entries (QuickBooks JournalEntry/
-- Transfer/CreditCardPayment) from hand-entered ones in reports.
ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type IN ('manual','bank_transaction','opening_balance','invoice_payment','reconciliation_adjustment','import'));
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql unavailable: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ Import schema created.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
