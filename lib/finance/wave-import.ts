// Wave has no viable API for a full historical pull (gated behind a
// possible paid-plan requirement, and no general transaction-read
// endpoint even when available) — this parses Wave's own CSV data
// exports instead. Dependency-free, same style as csv-import.ts, and
// reuses its low-level helpers rather than duplicating them.
import { parseCsvLines, toIsoDate } from "@/lib/finance/csv-import";
import type { StagedAccount, StagedCustomer } from "@/lib/finance/import-commit";

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

/** Maps Wave's account-type vocabulary to Sage Studio's 5-way type. Wave's
 * chart-of-accounts export uses its own category names, distinct from
 * QuickBooks' — kept as a separate map rather than reusing
 * QBO_ACCOUNT_TYPE_MAP so each source's vocabulary can evolve
 * independently. Unmapped types fall back to a generic expense bucket. */
const WAVE_ACCOUNT_TYPE_MAP: Record<string, { accountType: StagedAccount["accountType"]; accountSubtype: string }> = {
  "cash and bank": { accountType: "asset", accountSubtype: "Cash and Bank" },
  "accounts receivable": { accountType: "asset", accountSubtype: "Accounts Receivable" },
  "other current asset": { accountType: "asset", accountSubtype: "Other Current Asset" },
  "fixed asset": { accountType: "asset", accountSubtype: "Fixed Asset" },
  "credit card": { accountType: "liability", accountSubtype: "Credit Card" },
  "accounts payable": { accountType: "liability", accountSubtype: "Accounts Payable" },
  "other current liability": { accountType: "liability", accountSubtype: "Other Current Liability" },
  "long term liability": { accountType: "liability", accountSubtype: "Long Term Liability" },
  equity: { accountType: "equity", accountSubtype: "Owner's Equity" },
  income: { accountType: "income", accountSubtype: "Revenue" },
  "other income": { accountType: "income", accountSubtype: "Other Income" },
  expense: { accountType: "expense", accountSubtype: "Operating Expense" },
  "cost of goods sold": { accountType: "expense", accountSubtype: "Cost of Goods Sold" },
};

export type WaveParseResult<T> = { rows: T[]; skipped: number; errors: string[] };

/** Expects a header row with Account Name + Account Type (Wave's export
 * column names) — falls back to a generic expense mapping for any
 * unrecognized Account Type value rather than dropping the row, since an
 * imported account under the wrong bucket is far less damaging than a
 * silently-missing one. */
export function parseWaveChartOfAccountsCsv(text: string): WaveParseResult<StagedAccount> {
  const rows = parseCsvLines(text);
  if (rows.length === 0) return { rows: [], skipped: 0, errors: ["The file is empty"] };

  const header = rows[0].map(normalizeHeader);
  const nameIdx = header.findIndex((h) => ["account name", "name"].includes(h));
  const typeIdx = header.findIndex((h) => ["account type", "type"].includes(h));

  if (nameIdx === -1) {
    return { rows: [], skipped: 0, errors: ["Couldn't find an Account Name column — check the file's header row"] };
  }

  const accounts: StagedAccount[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = (row[nameIdx] ?? "").trim();
    if (!name) {
      skipped++;
      if (errors.length < 10) errors.push(`Row ${i + 1}: skipped (missing account name)`);
      continue;
    }
    const rawType = typeIdx !== -1 ? normalizeHeader(row[typeIdx] ?? "") : "";
    const mapped = WAVE_ACCOUNT_TYPE_MAP[rawType] ?? { accountType: "expense" as const, accountSubtype: "Other Expense" };
    accounts.push({ name, accountType: mapped.accountType, accountSubtype: mapped.accountSubtype, externalId: name });
  }

  return { rows: accounts, skipped, errors };
}

/** Expects a header row with Name/Customer Name + optional Email/Phone/
 * Address columns. */
export function parseWaveCustomersCsv(text: string): WaveParseResult<StagedCustomer> {
  const rows = parseCsvLines(text);
  if (rows.length === 0) return { rows: [], skipped: 0, errors: ["The file is empty"] };

  const header = rows[0].map(normalizeHeader);
  const nameIdx = header.findIndex((h) => ["customer name", "name"].includes(h));
  const emailIdx = header.findIndex((h) => h === "email");
  const phoneIdx = header.findIndex((h) => ["phone", "phone number"].includes(h));
  const addressIdx = header.findIndex((h) => ["address", "billing address"].includes(h));

  if (nameIdx === -1) {
    return { rows: [], skipped: 0, errors: ["Couldn't find a Customer Name column — check the file's header row"] };
  }

  const customers: StagedCustomer[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = (row[nameIdx] ?? "").trim();
    if (!name) {
      skipped++;
      if (errors.length < 10) errors.push(`Row ${i + 1}: skipped (missing customer name)`);
      continue;
    }
    customers.push({
      name,
      email: emailIdx !== -1 ? (row[emailIdx] ?? "").trim() || undefined : undefined,
      phone: phoneIdx !== -1 ? (row[phoneIdx] ?? "").trim() || undefined : undefined,
      address: addressIdx !== -1 ? (row[addressIdx] ?? "").trim() || undefined : undefined,
      externalId: name,
    });
  }

  return { rows: customers, skipped, errors };
}

// toIsoDate is re-exported for WaveImportWizard's future invoice-CSV parser
// (blocked on real Wave sample files, per the plan) and for consistency
// with csv-import.ts's date-handling conventions elsewhere in the importer.
export { toIsoDate };
