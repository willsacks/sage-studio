export type DefaultAccount = {
  name: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  account_subtype: string;
  is_default?: boolean;
  display_order: number;
};

// asset/expense accounts carry a debit normal balance; liability/equity/income
// carry credit — derived here once so callers never need a lookup table.
export function normalBalanceForType(type: DefaultAccount["account_type"]): "debit" | "credit" {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

export const PERSONAL_DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { name: "Checking", account_type: "asset", account_subtype: "Cash and Bank", display_order: 1 },
  { name: "Savings", account_type: "asset", account_subtype: "Cash and Bank", display_order: 2 },
  { name: "Cash on Hand", account_type: "asset", account_subtype: "Cash and Bank", display_order: 3 },
  { name: "Credit Card", account_type: "liability", account_subtype: "Credit Card", display_order: 10 },
  { name: "Personal Loan", account_type: "liability", account_subtype: "Loan Payable", display_order: 11 },
  { name: "Personal Equity", account_type: "equity", account_subtype: "Owner's Equity", display_order: 20 },
  { name: "Opening Balance Equity", account_type: "equity", account_subtype: "Owner's Equity", is_default: true, display_order: 21 },
  { name: "Salary / Day Job Income", account_type: "income", account_subtype: "Salary", display_order: 30 },
  { name: "Other Personal Income", account_type: "income", account_subtype: "Other Income", display_order: 31 },
  { name: "Groceries", account_type: "expense", account_subtype: "Living Expense", display_order: 40 },
  { name: "Housing", account_type: "expense", account_subtype: "Living Expense", display_order: 41 },
  { name: "Utilities", account_type: "expense", account_subtype: "Living Expense", display_order: 42 },
  { name: "Transportation", account_type: "expense", account_subtype: "Living Expense", display_order: 43 },
  { name: "Insurance", account_type: "expense", account_subtype: "Living Expense", display_order: 44 },
  { name: "Healthcare", account_type: "expense", account_subtype: "Living Expense", display_order: 45 },
  { name: "Entertainment", account_type: "expense", account_subtype: "Living Expense", display_order: 46 },
  { name: "Subscriptions", account_type: "expense", account_subtype: "Living Expense", display_order: 47 },
  { name: "Uncategorized Expense", account_type: "expense", account_subtype: "Other Expense", is_default: true, display_order: 99 },
];

// Business categories tuned for working creatives — the actual product
// differentiator versus a generic QuickBooks-style chart of accounts.
export const BUSINESS_DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { name: "Business Checking", account_type: "asset", account_subtype: "Cash and Bank", display_order: 1 },
  { name: "Business Savings", account_type: "asset", account_subtype: "Cash and Bank", display_order: 2 },
  { name: "Accounts Receivable", account_type: "asset", account_subtype: "Accounts Receivable", is_default: true, display_order: 3 },
  { name: "Gear & Equipment", account_type: "asset", account_subtype: "Fixed Asset", display_order: 4 },
  { name: "Business Credit Card", account_type: "liability", account_subtype: "Credit Card", display_order: 10 },
  { name: "Loan Payable", account_type: "liability", account_subtype: "Loan Payable", display_order: 11 },
  { name: "Owner's Investment / Draw", account_type: "equity", account_subtype: "Owner's Equity", display_order: 20 },
  { name: "Retained Earnings", account_type: "equity", account_subtype: "Retained Earnings", is_default: true, display_order: 21 },
  { name: "Opening Balance Equity", account_type: "equity", account_subtype: "Owner's Equity", is_default: true, display_order: 22 },
  { name: "Performance / Gig Revenue", account_type: "income", account_subtype: "Revenue", display_order: 30 },
  { name: "Streaming & Royalty Income", account_type: "income", account_subtype: "Revenue", display_order: 31 },
  { name: "Merch Sales", account_type: "income", account_subtype: "Revenue", display_order: 32 },
  { name: "Commission / Sale Revenue", account_type: "income", account_subtype: "Revenue", display_order: 33 },
  { name: "Grant / Sponsorship Income", account_type: "income", account_subtype: "Revenue", display_order: 34 },
  { name: "Other Income", account_type: "income", account_subtype: "Other Income", display_order: 35 },
  { name: "Studio / Recording Costs", account_type: "expense", account_subtype: "Cost of Production", display_order: 40 },
  { name: "Gear & Equipment (Expensed)", account_type: "expense", account_subtype: "Cost of Production", display_order: 41 },
  { name: "Venue / Rental Fees", account_type: "expense", account_subtype: "Cost of Production", display_order: 42 },
  { name: "Travel & Touring", account_type: "expense", account_subtype: "Operating Expense", display_order: 43 },
  { name: "Marketing & Promotion", account_type: "expense", account_subtype: "Operating Expense", display_order: 44 },
  { name: "Contract Labor", account_type: "expense", account_subtype: "Operating Expense", display_order: 45 },
  { name: "Software & Subscriptions", account_type: "expense", account_subtype: "Operating Expense", display_order: 46 },
  { name: "Materials & Supplies", account_type: "expense", account_subtype: "Operating Expense", display_order: 47 },
  { name: "Professional Fees", account_type: "expense", account_subtype: "Operating Expense", display_order: 48 },
  { name: "Platform & Distribution Fees", account_type: "expense", account_subtype: "Operating Expense", display_order: 49 },
  { name: "Uncategorized Expense", account_type: "expense", account_subtype: "Other Expense", is_default: true, display_order: 99 },
];

export function defaultAccountsForEntityType(entityType: "personal" | "business"): DefaultAccount[] {
  return entityType === "personal" ? PERSONAL_DEFAULT_ACCOUNTS : BUSINESS_DEFAULT_ACCOUNTS;
}
