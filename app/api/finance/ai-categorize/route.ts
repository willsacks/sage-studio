/**
 * Streaming multi-turn tool-calling agent for the Transactions tab's AI
 * categorization assistant. Modeled directly on app/api/ai-page-edit/route.ts's
 * loop shape (Anthropic SDK, messages.stream, execute tool_use blocks, push
 * tool_result, repeat until stop_reason !== "tool_use"). The key difference:
 * the page editor's tools mutate an in-memory working copy the user saves
 * later; these tools execute real, persisted actions (create an account,
 * create a rule, categorize matching transactions) as each call happens —
 * there's no separate "apply" step, matching how the user asked for this
 * ("auto categorize everything please").
 *
 * Gated by profiles.ai_finance_assistant_enabled — a separate flag from the
 * site-editor's ai_assistant_enabled, since this one can mutate real
 * financial data. Requires ANTHROPIC_API_KEY (already required by the
 * site-editor assistant).
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceEntityRole } from "@/lib/access/finance-access";
import { DEFAULT_SYSTEM_FINANCE_ASSISTANT } from "@/lib/ai/prompts";
import { getAiModel } from "@/lib/actions/admin";
import { FINANCE_TOOLS, financeToolCallLabel } from "@/lib/finance/ai-tools";
import { listChartOfAccounts, createChartAccount } from "@/lib/actions/finance-accounts";
import { listFinanceProjects, createFinanceProject } from "@/lib/actions/finance-projects";
import { listCategorizationRules, createCategorizationRule } from "@/lib/actions/finance-rules";
import { applyRuleToExistingTransactions } from "@/lib/finance/categorization-rules";

const MAX_TURNS = 20;

// A single create_rule_and_apply call can walk dozens of pre-existing
// transactions (one sequential categorizeTransaction DB round-trip each) —
// give it real headroom instead of the platform's short serverless default.
export const maxDuration = 300;

function emit(controller: ReadableStreamDefaultController, event: object) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
}

type KnownAccount = { id: string; name: string; account_type: string };
type KnownProject = { id: string; name: string };

function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const target = name.trim().toLowerCase();
  return items.find((i) => i.name.trim().toLowerCase() === target);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_finance_assistant_enabled")
    .eq("id", user.id)
    .single();
  if (!profile?.ai_finance_assistant_enabled) {
    return NextResponse.json({ error: "AI categorization assistant not enabled for this account" }, { status: 403 });
  }

  const body = await request.json() as {
    entityId: string;
    message: string;
    conversationHistory?: Anthropic.MessageParam[];
  };
  const { entityId, message, conversationHistory = [] } = body;
  if (!entityId || !message?.trim()) {
    return NextResponse.json({ error: "entityId and message are required" }, { status: 400 });
  }

  try {
    await requireFinanceEntityRole(supabase, entityId, user.id, "editor");
  } catch {
    return NextResponse.json({ error: "Not authorized on this entity" }, { status: 403 });
  }

  const [accountsResult, projectsResult, rulesResult, transactionsResult] = await Promise.all([
    listChartOfAccounts(entityId),
    listFinanceProjects(entityId),
    listCategorizationRules(entityId),
    supabase.from("transactions").select("payee_name, amount").eq("entity_id", entityId).eq("status", "uncategorized"),
  ]);

  const knownAccounts: KnownAccount[] = ((accountsResult.accounts ?? []) as { id: string; name: string; account_type: string; is_active: boolean }[])
    .filter((a) => a.is_active)
    .map((a) => ({ id: a.id, name: a.name, account_type: a.account_type }));
  const knownProjects: KnownProject[] = ((projectsResult.projects ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name }));
  const existingRules = (rulesResult.rules ?? []) as { match_type: string; match_value: string; chart_account_id: string }[];

  // Deduped so a payee with 40 occurrences doesn't flood the prompt — the
  // model only needs to know it exists and roughly how many/which direction.
  const uncategorized = (transactionsResult.data ?? []) as { payee_name: string; amount: number }[];
  const payeeSummary = new Map<string, { count: number; hasIn: boolean; hasOut: boolean }>();
  for (const t of uncategorized) {
    const entry = payeeSummary.get(t.payee_name) ?? { count: 0, hasIn: false, hasOut: false };
    entry.count++;
    if (t.amount >= 0) entry.hasIn = true; else entry.hasOut = true;
    payeeSummary.set(t.payee_name, entry);
  }

  const accountsList = knownAccounts.map((a) => `- ${a.name} (${a.account_type})`).join("\n") || "(none yet)";
  const projectsList = knownProjects.map((p) => `- ${p.name}`).join("\n") || "(none)";
  const rulesList = existingRules.map((r) => `- ${r.match_type} "${r.match_value}"`).join("\n") || "(none yet)";
  const payeesList = Array.from(payeeSummary.entries())
    .map(([name, { count, hasIn, hasOut }]) => `- "${name}" (${count} transaction${count === 1 ? "" : "s"}, ${hasIn && hasOut ? "both directions" : hasIn ? "money in" : "money out"})`)
    .join("\n") || "(none — everything is already categorized)";

  const system = `${DEFAULT_SYSTEM_FINANCE_ASSISTANT}

CURRENT CHART OF ACCOUNTS:
${accountsList}

CURRENT PROJECTS:
${projectsList}

EXISTING CATEGORIZATION RULES (don't duplicate these):
${rulesList}

CURRENTLY UNCATEGORIZED TRANSACTIONS (deduped by payee):
${payeesList}`;

  const model = await getAiModel();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const stream = new ReadableStream({
    async start(controller) {
      const conversationMessages: Anthropic.MessageParam[] = [...conversationHistory, { role: "user", content: message }];
      let turns = 0;

      try {
        while (turns < MAX_TURNS) {
          turns++;
          const messageStream = anthropic.messages.stream({
            model,
            max_tokens: 4096,
            system,
            tools: FINANCE_TOOLS,
            messages: conversationMessages,
          });

          messageStream.on("text", (text) => {
            emit(controller, { type: "text", content: text });
          });

          const responseMessage = await messageStream.finalMessage();
          conversationMessages.push({ role: "assistant", content: responseMessage.content });

          if (responseMessage.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of responseMessage.content) {
            if (block.type !== "tool_use") continue;
            const input = block.input as Record<string, unknown>;
            emit(controller, { type: "tool_call", name: block.name, label: financeToolCallLabel(block.name, input) });

            let resultText: string;
            let isError = false;

            try {
              switch (block.name) {
                case "create_account": {
                  const name = String(input.name ?? "").trim();
                  const accountType = input.accountType as "income" | "expense" | "asset" | "liability";
                  const accountSubtype = String(input.accountSubtype ?? "Other");
                  if (findByName(knownAccounts, name)) {
                    resultText = `An account named "${name}" already exists — use that one instead of creating a duplicate.`;
                    isError = true;
                    break;
                  }
                  const result = await createChartAccount({ entityId, name, accountType, accountSubtype });
                  if (!result.accountId) { resultText = result.error ?? "Failed to create account"; isError = true; break; }
                  knownAccounts.push({ id: result.accountId, name, account_type: accountType });
                  resultText = `Created account "${name}".`;
                  emit(controller, { type: "action_result", label: `Created account "${name}"` });
                  break;
                }
                case "create_project": {
                  const name = String(input.name ?? "").trim();
                  if (findByName(knownProjects, name)) {
                    resultText = `A project named "${name}" already exists — use that one instead.`;
                    isError = true;
                    break;
                  }
                  const result = await createFinanceProject({ entityId, name });
                  if (!result.projectId) { resultText = result.error ?? "Failed to create project"; isError = true; break; }
                  knownProjects.push({ id: result.projectId, name });
                  resultText = `Created project "${name}".`;
                  emit(controller, { type: "action_result", label: `Created project "${name}"` });
                  break;
                }
                case "create_rule_and_apply": {
                  const matchType = input.matchType as "contains" | "exact" | "starts_with";
                  const matchValue = String(input.matchValue ?? "").trim();
                  const accountName = String(input.accountName ?? "").trim();
                  const projectName = input.projectName ? String(input.projectName).trim() : undefined;

                  const account = findByName(knownAccounts, accountName);
                  if (!account) {
                    resultText = `No account named "${accountName}" exists — call create_account first, then retry with the exact name you used.`;
                    isError = true;
                    break;
                  }
                  const project = projectName ? findByName(knownProjects, projectName) : undefined;
                  if (projectName && !project) {
                    resultText = `No project named "${projectName}" exists — call create_project first, or omit projectName.`;
                    isError = true;
                    break;
                  }

                  const created = await createCategorizationRule({
                    entityId,
                    matchType,
                    matchValue,
                    chartAccountId: account.id,
                    defaultProjectId: project?.id,
                  });
                  if ("error" in created) { resultText = created.error ?? "Failed to create rule"; isError = true; break; }

                  const applied = await applyRuleToExistingTransactions(supabase, {
                    entityId,
                    rule: { id: "", match_type: matchType, match_value: matchValue, chart_account_id: account.id, default_project_id: project?.id ?? null, priority: 0 },
                    onProgress: (done, total) => {
                      if (total > 1) {
                        emit(controller, {
                          type: "tool_call",
                          name: "create_rule_and_apply",
                          label: `Applying rule: ${matchType} "${matchValue}" → ${accountName}... (${done}/${total})`,
                        });
                      }
                    },
                  });
                  resultText = `Rule created (${matchType} "${matchValue}" → ${accountName}). Matched and categorized ${applied.matchedCount} existing transaction${applied.matchedCount === 1 ? "" : "s"}.`;
                  emit(controller, {
                    type: "action_result",
                    label: `Rule: ${matchType} "${matchValue}" → ${accountName} (${applied.matchedCount} categorized)`,
                  });
                  break;
                }
                case "list_uncategorized_summary": {
                  const { data: remaining } = await supabase
                    .from("transactions")
                    .select("payee_name, amount, date")
                    .eq("entity_id", entityId)
                    .eq("status", "uncategorized")
                    .limit(25);
                  const rows = (remaining ?? []) as { payee_name: string; amount: number; date: string }[];
                  resultText = rows.length === 0
                    ? "No uncategorized transactions remain."
                    : rows.map((r) => `${r.date} — ${r.payee_name} (${r.amount >= 0 ? "+" : ""}${r.amount})`).join("\n");
                  break;
                }
                default:
                  resultText = `Unknown tool: ${block.name}`;
                  isError = true;
              }
            } catch (err) {
              resultText = err instanceof Error ? err.message : "Tool execution failed";
              isError = true;
            }

            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultText, is_error: isError });
          }

          conversationMessages.push({ role: "user", content: toolResults });
        }

        emit(controller, { type: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        emit(controller, { type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
