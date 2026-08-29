// Dependency-free CSV parsing for bank transaction exports. Supports the
// two common shapes: a single signed "Amount" column, or separate
// "Debit"/"Credit" columns — covers the large majority of real bank/credit
// card exports without needing a full column-mapping UI.

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      // Only treat a quote as opening a quoted field when it's the very
      // first character of that field — a stray quote mid-field (e.g. a
      // payee name like `3" Pipe Fitting Co`) is just a literal character,
      // not the start of quoting, otherwise it swallows every comma/newline
      // until the next quote and silently merges/corrupts following rows.
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export type ParsedCsvTransaction = { date: string; payeeName: string; amount: number };
export type CsvParseResult = { transactions: ParsedCsvTransaction[]; skipped: number; errors: string[] };

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function toIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    // Reject out-of-range values instead of emitting an invalid date like
    // "2024-25-03" — a DD/MM/YYYY file (common outside the US) would
    // otherwise silently produce a date Postgres rejects, aborting the
    // whole batch insert rather than just skipping the one bad row.
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${mdy[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const negative = /^\(.*\)$/.test(cleaned);
  const num = Number(cleaned.replace(/[()]/g, ""));
  if (isNaN(num)) return null;
  return negative ? -num : num;
}

/** Parses a bank CSV export. `amount` is normalized to Sage Studio's own
 * convention (positive = cash in, negative = cash out) regardless of
 * whether the source file used a single signed column or separate
 * Debit/Credit columns. */
export function parseTransactionsCsv(text: string): CsvParseResult {
  const rows = parseCsvLines(text);
  if (rows.length === 0) return { transactions: [], skipped: 0, errors: ["The file is empty"] };

  const header = rows[0].map(normalizeHeader);
  const dateIdx = header.findIndex((h) => h === "date" || h === "transaction date" || h === "posted date");
  const descIdx = header.findIndex((h) => ["description", "payee", "name", "merchant"].includes(h));
  const amountIdx = header.findIndex((h) => h === "amount");
  const debitIdx = header.findIndex((h) => h === "debit");
  const creditIdx = header.findIndex((h) => h === "credit");

  if (dateIdx === -1 || descIdx === -1 || (amountIdx === -1 && debitIdx === -1 && creditIdx === -1)) {
    return {
      transactions: [],
      skipped: 0,
      errors: ["Couldn't find Date, Description, and Amount (or Debit/Credit) columns — check the file's header row"],
    };
  }

  const transactions: ParsedCsvTransaction[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = toIsoDate(row[dateIdx] ?? "");
    const payeeName = (row[descIdx] ?? "").trim();

    let amount: number | null = null;
    if (amountIdx !== -1) {
      amount = parseAmount(row[amountIdx] ?? "");
    } else {
      const debit = parseAmount(row[debitIdx] ?? "") ?? 0;
      const credit = parseAmount(row[creditIdx] ?? "") ?? 0;
      amount = credit - debit;
    }

    if (!date || !payeeName || amount === null || amount === 0) {
      skipped++;
      if (errors.length < 10) {
        const reason = !date
          ? "unrecognized or missing date"
          : !payeeName
          ? "missing description"
          : amount === null
          ? "unrecognized or missing amount"
          : "amount is zero";
        errors.push(`Row ${i + 1}: skipped (${reason})`);
      }
      continue;
    }

    transactions.push({ date, payeeName, amount });
  }

  return { transactions, skipped, errors };
}
