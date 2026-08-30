import type Anthropic from "@anthropic-ai/sdk";

/** Tool schemas for the Transactions-tab AI categorization assistant
 * (app/api/finance/ai-categorize/route.ts). Modeled on lib/utils/ai-tools.ts's
 * BLOCK_TOOLS/HTML_TOOLS — the difference is these tools execute real,
 * persisted financial actions immediately (no separate "apply" step),
 * since the whole point is turning one instruction into applied rules. */
export const FINANCE_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_account",
    description:
      "Creates a new chart-of-accounts entry. Only use this when no existing account (listed in the system prompt) already fits — prefer reusing an existing account whenever possible. For a transfer target (savings, investment, retirement, brokerage account like Acorns), use accountType \"asset\" and accountSubtype \"Investment\" — never create a transfer target as an income or expense category.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Display name for the account, e.g. \"AI Expenses\" or \"Acorns\"." },
        accountType: { type: "string", enum: ["income", "expense", "asset", "liability"], description: "\"asset\" for a money/transfer-target account, \"income\"/\"expense\" for a category." },
        accountSubtype: { type: "string", description: "E.g. \"Investment\" for a transfer target, or a short free-text category subtype like \"Software\" for an expense." },
      },
      required: ["name", "accountType", "accountSubtype"],
    },
  },
  {
    name: "create_project",
    description: "Creates a new project — only use this if the user's instruction explicitly names a project to tag transactions with, not for ordinary categorization.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_rule_and_apply",
    description:
      "Creates a categorization rule and immediately applies it to every existing uncategorized transaction that matches, in addition to auto-categorizing matching transactions in the future. Returns how many existing transactions it matched. This is the main tool — most instructions translate into one or more calls to this.",
    input_schema: {
      type: "object",
      properties: {
        matchType: { type: "string", enum: ["contains", "exact", "starts_with"], description: "How matchValue is compared against a transaction's payee name (case-insensitive). Default to \"contains\" unless the instruction implies otherwise." },
        matchValue: { type: "string", description: "The text to match against the transaction's payee/description, e.g. \"Anthropic\" or \"Acorns\"." },
        accountName: { type: "string", description: "The exact name of the account to categorize matching transactions against — an existing account from the system prompt, or one you just created with create_account in this same conversation." },
        projectName: { type: "string", description: "Optional — an existing or just-created project name to also tag matching transactions with." },
      },
      required: ["matchType", "matchValue", "accountName"],
    },
  },
  {
    name: "list_uncategorized_summary",
    description: "Lists up to 25 remaining uncategorized transactions (deduped by payee name) — use this after applying your main rules if you want to double-check what's left before writing your final summary, not as your primary way of discovering what needs categorizing (that's already provided in the system prompt).",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

/** Short human-readable label shown in the chat UI's activity log while a
 * tool call is in flight — mirrors lib/utils/ai-tools.ts's toolCallLabel. */
export function financeToolCallLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "create_account":
      return `Creating account "${input.name}"...`;
    case "create_project":
      return `Creating project "${input.name}"...`;
    case "create_rule_and_apply":
      return `Applying rule: ${input.matchType} "${input.matchValue}" → ${input.accountName}...`;
    case "list_uncategorized_summary":
      return "Checking what's still uncategorized...";
    default:
      return name;
  }
}
