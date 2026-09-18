/**
 * Course pricing + per-student discounts, tied into Finances:
 * - courses.price_cents: the course's normal price (null = free).
 * - enrollments.price_paid_cents: what this specific student actually
 *   pays — defaults to the course price but can be set lower (a discount)
 *   or to 0 (comped) per enrollment, per the ask to offer some students a
 *   course free or discounted.
 * - enrollments.invoice_id: the Finance invoice created for a paid
 *   enrollment, if the instructor has a finance entity set up. Nullable —
 *   free/comped enrollments and instructors without Finances configured
 *   simply have no invoice.
 *
 * Run: cd sage-studio && npx tsx scripts/add-course-pricing-schema.ts
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

async function main() {
  const { error } = await supabase.rpc("exec_sql" as never, {
    sql: `
      alter table public.courses add column if not exists price_cents integer;
      alter table public.enrollments add column if not exists price_paid_cents integer;
      alter table public.enrollments add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
    `,
  } as never);
  if (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
  else console.log("✓ add course pricing / enrollment price+invoice columns");
}

main().catch((err) => { console.error(err); process.exit(1); });
