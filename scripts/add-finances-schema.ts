/**
 * Schema for the Finances module — creator-focused project profitability
 * tracking backed by a real double-entry ledger. Full table set (through
 * Phase 4) created now so RLS/constraint design only happens once; UI for
 * bank connections/invoicing/reconciliation/tax ships in later phases.
 *
 * Run: cd sage-studio && npx tsx scripts/add-finances-schema.ts
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
-- Core: entities (personal / business, many of either per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_entities (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                    text        NOT NULL,
  entity_type             text        NOT NULL CHECK (entity_type IN ('personal','business')),
  currency                text        NOT NULL DEFAULT 'USD',
  fiscal_year_start_month int         NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_entities_owner ON public.finance_entities(owner_id);

CREATE TABLE IF NOT EXISTS public.finance_entity_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id  uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('viewer','editor','manager','owner')),
  status     text        NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, user_id)
);

-- SECURITY DEFINER so entity-access checks bypass RLS internally instead of
-- re-triggering policies on themselves (infinite recursion), same pattern
-- as public.is_site_manager for site_collaborators.
CREATE OR REPLACE FUNCTION public.is_finance_entity_member(p_entity_id uuid, p_user_id uuid, p_min_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.finance_entities e WHERE e.id = p_entity_id AND e.owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.finance_entity_members m
    WHERE m.entity_id = p_entity_id AND m.user_id = p_user_id AND m.status = 'accepted'
      AND (
        p_min_role = 'viewer'
        OR (p_min_role = 'editor' AND m.role IN ('editor','manager','owner'))
        OR (p_min_role = 'manager' AND m.role IN ('manager','owner'))
        OR (p_min_role = 'owner' AND m.role = 'owner')
      )
  );
$$;

ALTER TABLE public.finance_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their finance entities" ON public.finance_entities;
CREATE POLICY "Members access their finance entities" ON public.finance_entities
  FOR ALL
  USING (owner_id = auth.uid() OR public.is_finance_entity_member(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.finance_entity_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage entity members" ON public.finance_entity_members;
CREATE POLICY "Owners manage entity members" ON public.finance_entity_members
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.finance_entities e WHERE e.id = entity_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.finance_entities e WHERE e.id = entity_id AND e.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Members view their own membership" ON public.finance_entity_members;
CREATE POLICY "Members view their own membership" ON public.finance_entity_members
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- Ledger engine: chart of accounts, journal entries/lines
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  account_type     text        NOT NULL CHECK (account_type IN ('asset','liability','equity','income','expense')),
  account_subtype  text        NOT NULL,
  normal_balance   text        NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_default       boolean     NOT NULL DEFAULT false,
  is_active        boolean     NOT NULL DEFAULT true,
  parent_account_id uuid       REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  display_order    int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, name)
);
CREATE INDEX IF NOT EXISTS idx_coa_entity ON public.chart_of_accounts(entity_id);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  entry_date            date        NOT NULL,
  description           text,
  source_type           text        NOT NULL CHECK (source_type IN ('manual','bank_transaction','opening_balance','invoice_payment','reconciliation_adjustment')),
  source_transaction_id uuid,
  created_by            uuid        NOT NULL REFERENCES public.profiles(id),
  is_locked             boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entity ON public.journal_entries(entity_id, entry_date);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid        NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id       uuid        NOT NULL REFERENCES public.chart_of_accounts(id),
  debit            numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit           numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo             text,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS idx_jel_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON public.journal_entry_lines(account_id);

-- Hard backstop: every journal entry must balance. Runs per-statement so
-- multi-row inserts in one transaction are checked once, not per-row.
CREATE OR REPLACE FUNCTION public.check_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  unbalanced_id uuid;
BEGIN
  SELECT journal_entry_id INTO unbalanced_id
  FROM public.journal_entry_lines
  WHERE journal_entry_id IN (SELECT DISTINCT journal_entry_id FROM new_or_old_rows)
  GROUP BY journal_entry_id
  HAVING ROUND(SUM(debit) - SUM(credit), 2) != 0
  LIMIT 1;

  IF unbalanced_id IS NOT NULL THEN
    RAISE EXCEPTION 'Journal entry % does not balance (debits must equal credits)', unbalanced_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Plain (non-constraint) statement-level triggers: Postgres doesn't support
-- REFERENCING transition tables on CONSTRAINT TRIGGERs, so this can't be
-- DEFERRABLE. That's fine in practice — lib/finance/ledger.ts always inserts
-- every line of a journal entry in one bulk INSERT, so the full set is
-- always visible to this statement-level check in a single pass.
DROP TRIGGER IF EXISTS trg_journal_entry_lines_balance_ins ON public.journal_entry_lines;
CREATE TRIGGER trg_journal_entry_lines_balance_ins
  AFTER INSERT ON public.journal_entry_lines
  REFERENCING NEW TABLE AS new_or_old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.check_journal_entry_balance();

DROP TRIGGER IF EXISTS trg_journal_entry_lines_balance_upd ON public.journal_entry_lines;
CREATE TRIGGER trg_journal_entry_lines_balance_upd
  AFTER UPDATE ON public.journal_entry_lines
  REFERENCING NEW TABLE AS new_or_old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.check_journal_entry_balance();

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members access their chart of accounts" ON public.chart_of_accounts
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their journal entries" ON public.journal_entries;
CREATE POLICY "Members access their journal entries" ON public.journal_entries
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their journal entry lines" ON public.journal_entry_lines;
CREATE POLICY "Members access their journal entry lines" ON public.journal_entry_lines
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_id AND public.is_finance_entity_member(je.entity_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_id AND public.is_finance_entity_member(je.entity_id, auth.uid(), 'editor')
  ));

-- ============================================================
-- Projects (the product differentiator)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  project_type  text,
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  start_date    date,
  end_date      date,
  budget        numeric(14,2),
  description   text,
  client_name   text,
  display_order int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_projects_entity ON public.finance_projects(entity_id);

ALTER TABLE public.finance_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their projects" ON public.finance_projects;
CREATE POLICY "Members access their projects" ON public.finance_projects
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

-- ============================================================
-- Bank connections (Plaid) — schema now, UI in Phase 2
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plaid_item_id               text        NOT NULL UNIQUE,
  plaid_access_token_encrypted text       NOT NULL,
  institution_name            text,
  institution_logo_url        text,
  plaid_cursor                text,
  status                      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','error','revoked')),
  last_synced_at              timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_connections_owner ON public.bank_connections(owner_id);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id  uuid        NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  entity_id           uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  chart_account_id    uuid        REFERENCES public.chart_of_accounts(id),
  plaid_account_id    text        NOT NULL,
  name                text        NOT NULL,
  mask                text,
  account_type        text,
  current_balance     numeric(14,2),
  available_balance   numeric(14,2),
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_connection_id, plaid_account_id)
);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_entity ON public.bank_accounts(entity_id);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners access their bank connections" ON public.bank_connections;
CREATE POLICY "Owners access their bank connections" ON public.bank_connections
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their bank accounts" ON public.bank_accounts;
CREATE POLICY "Members access their bank accounts" ON public.bank_accounts
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

-- ============================================================
-- Transactions + splits (project-aware) + categorization rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  bank_account_id     uuid        REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  plaid_transaction_id text       UNIQUE,
  date                date        NOT NULL,
  payee_name          text        NOT NULL,
  amount              numeric(14,2) NOT NULL,
  status              text        NOT NULL DEFAULT 'uncategorized' CHECK (status IN ('uncategorized','categorized','excluded')),
  journal_entry_id    uuid        REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  is_split            boolean     NOT NULL DEFAULT false,
  reconciliation_id   uuid,
  cleared_at          timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_entity ON public.transactions(entity_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON public.transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(entity_id, status);

CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    uuid        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  chart_account_id  uuid        NOT NULL REFERENCES public.chart_of_accounts(id),
  project_id        uuid        REFERENCES public.finance_projects(id) ON DELETE SET NULL,
  amount            numeric(14,2) NOT NULL,
  memo              text
);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_txn ON public.transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_project ON public.transaction_splits(project_id);

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  match_type         text        NOT NULL CHECK (match_type IN ('contains','exact','starts_with')),
  match_value        text        NOT NULL,
  chart_account_id   uuid        NOT NULL REFERENCES public.chart_of_accounts(id),
  default_project_id uuid        REFERENCES public.finance_projects(id) ON DELETE SET NULL,
  priority           int         NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_entity ON public.categorization_rules(entity_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their transactions" ON public.transactions;
CREATE POLICY "Members access their transactions" ON public.transactions
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their transaction splits" ON public.transaction_splits;
CREATE POLICY "Members access their transaction splits" ON public.transaction_splits
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_id AND public.is_finance_entity_member(t.entity_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_id AND public.is_finance_entity_member(t.entity_id, auth.uid(), 'editor')
  ));

ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their categorization rules" ON public.categorization_rules;
CREATE POLICY "Members access their categorization rules" ON public.categorization_rules
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

-- ============================================================
-- Reconciliations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reconciliations (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id           uuid        NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_start_date      date        NOT NULL,
  statement_end_date        date        NOT NULL,
  statement_ending_balance  numeric(14,2) NOT NULL,
  beginning_balance         numeric(14,2) NOT NULL DEFAULT 0,
  status                    text        NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  completed_at              timestamptz,
  completed_by              uuid        REFERENCES public.profiles(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reconciliations_account ON public.reconciliations(bank_account_id);

ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_reconciliation
  FOREIGN KEY (reconciliation_id) REFERENCES public.reconciliations(id) ON DELETE SET NULL;

ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their reconciliations" ON public.reconciliations;
CREATE POLICY "Members access their reconciliations" ON public.reconciliations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.id = bank_account_id AND public.is_finance_entity_member(ba.entity_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.id = bank_account_id AND public.is_finance_entity_member(ba.entity_id, auth.uid(), 'editor')
  ));

-- ============================================================
-- Invoicing
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  project_id      uuid        REFERENCES public.finance_projects(id) ON DELETE SET NULL,
  client_name     text        NOT NULL,
  client_email    text,
  invoice_number  text        NOT NULL,
  issue_date      date        NOT NULL,
  due_date        date,
  status          text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','paid','overdue','void')),
  subtotal        numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(14,2) NOT NULL DEFAULT 0,
  total           numeric(14,2) NOT NULL DEFAULT 0,
  notes           text,
  pdf_storage_path text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_entity ON public.invoices(entity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices(project_id);

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text        NOT NULL,
  quantity    numeric(14,2) NOT NULL DEFAULT 1,
  unit_price  numeric(14,2) NOT NULL DEFAULT 0,
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  display_order int       NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount                numeric(14,2) NOT NULL,
  paid_date             date        NOT NULL,
  method                text,
  matched_transaction_id uuid       REFERENCES public.transactions(id) ON DELETE SET NULL,
  journal_entry_id      uuid        REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their invoices" ON public.invoices;
CREATE POLICY "Members access their invoices" ON public.invoices
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their invoice line items" ON public.invoice_line_items;
CREATE POLICY "Members access their invoice line items" ON public.invoice_line_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND public.is_finance_entity_member(i.entity_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND public.is_finance_entity_member(i.entity_id, auth.uid(), 'editor')
  ));

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their invoice payments" ON public.invoice_payments;
CREATE POLICY "Members access their invoice payments" ON public.invoice_payments
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND public.is_finance_entity_member(i.entity_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND public.is_finance_entity_member(i.entity_id, auth.uid(), 'editor')
  ));

-- ============================================================
-- Tax set-aside settings (estimate only, not tax advice)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_tax_settings (
  entity_id          uuid        PRIMARY KEY REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  reserve_percentage numeric(5,2) NOT NULL DEFAULT 27.00,
  tax_year_start_month int       NOT NULL DEFAULT 1 CHECK (tax_year_start_month BETWEEN 1 AND 12),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_tax_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their tax settings" ON public.finance_tax_settings;
CREATE POLICY "Members access their tax settings" ON public.finance_tax_settings
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql unavailable: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ Finances schema created.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
