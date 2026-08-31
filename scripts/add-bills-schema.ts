/**
 * Adds accounts payable — bills owed to vendors that aren't just bank-fed
 * expenses (e.g. invoiced by a vendor, paid later). Mirrors the existing
 * invoices/invoice_line_items/invoice_payments (AR) structure exactly: the
 * bill itself is a lightweight tracking layer (open/partial/paid/void),
 * and only recording a *payment* against it touches the ledger — same
 * "matches how a solo creative actually thinks about it" reasoning as
 * recordInvoicePayment (lib/actions/finance-invoices.ts).
 *
 * Run: cd sage-studio && npx tsx scripts/add-bills-schema.ts
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
CREATE TABLE IF NOT EXISTS public.bills (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid        NOT NULL REFERENCES public.finance_entities(id) ON DELETE CASCADE,
  project_id      uuid        REFERENCES public.finance_projects(id) ON DELETE SET NULL,
  vendor_name     text        NOT NULL,
  bill_number     text        NOT NULL,
  bill_date       date        NOT NULL,
  due_date        date,
  status          text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','void')),
  subtotal        numeric(14,2) NOT NULL DEFAULT 0,
  total           numeric(14,2) NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, bill_number)
);
CREATE INDEX IF NOT EXISTS idx_bills_entity ON public.bills(entity_id);
CREATE INDEX IF NOT EXISTS idx_bills_project ON public.bills(project_id);

CREATE TABLE IF NOT EXISTS public.bill_line_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id       uuid        NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  description   text        NOT NULL,
  account_id    uuid        NOT NULL REFERENCES public.chart_of_accounts(id),
  amount        numeric(14,2) NOT NULL DEFAULT 0,
  display_order int         NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill ON public.bill_line_items(bill_id);

CREATE TABLE IF NOT EXISTS public.bill_payments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id               uuid        NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount                numeric(14,2) NOT NULL,
  paid_date             date        NOT NULL,
  method                text,
  matched_transaction_id uuid       REFERENCES public.transactions(id) ON DELETE SET NULL,
  journal_entry_id      uuid        REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON public.bill_payments(bill_id);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their bills" ON public.bills;
CREATE POLICY "Members access their bills" ON public.bills
  FOR ALL
  USING (public.is_finance_entity_member(entity_id, auth.uid()))
  WITH CHECK (public.is_finance_entity_member(entity_id, auth.uid(), 'editor'));

ALTER TABLE public.bill_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their bill line items" ON public.bill_line_items;
CREATE POLICY "Members access their bill line items" ON public.bill_line_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND public.is_finance_entity_member(b.entity_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND public.is_finance_entity_member(b.entity_id, auth.uid(), 'editor')
  ));

ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members access their bill payments" ON public.bill_payments;
CREATE POLICY "Members access their bill payments" ON public.bill_payments
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND public.is_finance_entity_member(b.entity_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND public.is_finance_entity_member(b.entity_id, auth.uid(), 'editor')
  ));
`.trim();

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL } as never);
  if (error) {
    console.error(`✗ exec_sql failed: ${error.message}`);
    console.log("\nRun this SQL manually in the Supabase dashboard SQL editor:\n");
    console.log(SQL);
    process.exitCode = 1;
  } else {
    console.log("✓ bills / bill_line_items / bill_payments tables added.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
