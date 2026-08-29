import type { StagedAccount, StagedCustomer, StagedInvoice, StagedPayment } from "@/lib/finance/import-commit";

type QboAccount = {
  Id: string;
  Name: string;
  AccountType: string;
  ParentRef?: { value: string };
};

type QboContact = {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string };
};

/** Maps QuickBooks' AccountType vocabulary to Sage Studio's 5-way
 * account_type + a matching account_subtype. Unmapped/unusual types fall
 * back to a generic bucket per the closest account_type rather than
 * failing the whole account import over one unrecognized row. */
const QBO_ACCOUNT_TYPE_MAP: Record<string, { accountType: StagedAccount["accountType"]; accountSubtype: string }> = {
  Bank: { accountType: "asset", accountSubtype: "Cash and Bank" },
  "Other Current Asset": { accountType: "asset", accountSubtype: "Other Current Asset" },
  "Fixed Asset": { accountType: "asset", accountSubtype: "Fixed Asset" },
  "Other Asset": { accountType: "asset", accountSubtype: "Other Asset" },
  "Accounts Receivable": { accountType: "asset", accountSubtype: "Accounts Receivable" },
  Equity: { accountType: "equity", accountSubtype: "Owner's Equity" },
  Expense: { accountType: "expense", accountSubtype: "Operating Expense" },
  "Other Expense": { accountType: "expense", accountSubtype: "Other Expense" },
  "Cost of Goods Sold": { accountType: "expense", accountSubtype: "Cost of Goods Sold" },
  "Accounts Payable": { accountType: "liability", accountSubtype: "Accounts Payable" },
  "Credit Card": { accountType: "liability", accountSubtype: "Credit Card" },
  "Long Term Liability": { accountType: "liability", accountSubtype: "Long Term Liability" },
  "Other Current Liability": { accountType: "liability", accountSubtype: "Other Current Liability" },
  Income: { accountType: "income", accountSubtype: "Revenue" },
  "Other Income": { accountType: "income", accountSubtype: "Other Income" },
};

export function mapQboAccount(account: QboAccount): StagedAccount {
  const mapped = QBO_ACCOUNT_TYPE_MAP[account.AccountType] ?? { accountType: "expense" as const, accountSubtype: "Other Expense" };
  return {
    name: account.Name,
    accountType: mapped.accountType,
    accountSubtype: mapped.accountSubtype,
    externalId: account.Id,
    parentExternalId: account.ParentRef?.value,
  };
}

type QboInvoice = {
  Id: string;
  DocNumber?: string;
  TxnDate: string;
  DueDate?: string;
  CustomerRef?: { value: string };
  Line: { DetailType: string; Amount: number; Description?: string; SalesItemLineDetail?: { Qty?: number; UnitPrice?: number } }[];
  TotalAmt: number;
  TxnTaxDetail?: { TotalTax?: number };
};

/** Maps a QuickBooks Invoice to the staged shape commitInvoiceBatch expects.
 * Only SalesItemLineDetail lines become line items — QBO invoices also
 * include SubTotalLineDetail/DiscountLineDetail summary lines that aren't
 * real billable items. */
export function mapQboInvoice(invoice: QboInvoice): StagedInvoice {
  const lineItems = invoice.Line.filter((l) => l.DetailType === "SalesItemLineDetail").map((l) => ({
    description: l.Description ?? "Item",
    quantity: l.SalesItemLineDetail?.Qty ?? 1,
    unitPrice: l.SalesItemLineDetail?.UnitPrice ?? l.Amount,
  }));

  return {
    externalId: invoice.Id,
    invoiceNumber: invoice.DocNumber,
    customerExternalId: invoice.CustomerRef?.value,
    issueDate: invoice.TxnDate,
    dueDate: invoice.DueDate,
    lineItems,
    taxAmount: invoice.TxnTaxDetail?.TotalTax,
    totalOverride: invoice.TotalAmt,
  };
}

type QboPayment = {
  Id: string;
  TotalAmt: number;
  TxnDate: string;
  DepositToAccountRef?: { value: string };
  Line?: { Amount: number; LinkedTxn?: { TxnId: string; TxnType: string }[] }[];
};

/** A single QuickBooks Payment can apply to multiple invoices (split across
 * several LinkedTxn entries) — mapped to one StagedPayment per linked
 * invoice, each for that line's own amount rather than the payment's full
 * total, so a split payment doesn't get double-counted against either
 * invoice. */
export function mapQboPayment(payment: QboPayment): StagedPayment[] {
  const invoiceLinks = (payment.Line ?? [])
    .flatMap((l) => (l.LinkedTxn ?? []).filter((t) => t.TxnType === "Invoice").map((t) => ({ invoiceId: t.TxnId, amount: l.Amount })));

  if (invoiceLinks.length === 0) return [];

  return invoiceLinks.map((link) => ({
    invoiceExternalId: link.invoiceId,
    amount: link.amount,
    paidDate: payment.TxnDate,
    moneyAccountExternalId: payment.DepositToAccountRef?.value,
  }));
}

export function mapQboContact(contact: QboContact): StagedCustomer {
  const addressParts = [contact.BillAddr?.Line1, contact.BillAddr?.City, contact.BillAddr?.CountrySubDivisionCode, contact.BillAddr?.PostalCode].filter(Boolean);
  return {
    name: contact.DisplayName,
    email: contact.PrimaryEmailAddr?.Address,
    phone: contact.PrimaryPhone?.FreeFormNumber,
    address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
    externalId: contact.Id,
  };
}
