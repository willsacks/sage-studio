/**
 * Streaming multi-turn tool-calling agent loop for the AI page editor (both the
 * block builder and the HTML editor share this one route, switched by editorType).
 *
 * Each request holds the page state (blocks array or HTML string) in memory only —
 * nothing is persisted here. Tool calls mutate that in-memory working copy as the
 * model makes them; the response is a newline-delimited JSON stream the client
 * applies live: {type:"text"} for chat copy, {type:"tool_call"} for the activity
 * indicator, {type:"state_update"} after every tool call so edits appear in real
 * time, {type:"final_state"} once the loop ends, {type:"done"|"error"} to close out.
 *
 * Saving to the database still goes through the normal Save button — AI edits
 * flow into the same onChange/setBlocks path as manual edits, so nothing here
 * auto-publishes anything.
 *
 * Gated by profiles.ai_assistant_enabled (off by default, toggled per-user from
 * /admin — see components/admin/AiAccessTable.tsx) rather than a Pro-plan check,
 * so it can be rolled out to specific accounts first. Requires ANTHROPIC_API_KEY
 * to be set — as of this writing it is NOT yet in .env.local or Vercel env.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_SYSTEM_BLOCK, DEFAULT_SYSTEM_HTML } from "@/lib/ai/prompts";
import { DEFAULT_AI_MODEL } from "@/lib/ai/models";
import { BLOCK_TOOLS, HTML_TOOLS, toolCallLabel } from "@/lib/utils/ai-tools";
import {
  addBlock, updateBlockData, moveBlock, removeBlock, duplicateBlock,
} from "@/lib/utils/block-mutations";
import {
  setTextContent, setAttribute, setInlineStyle, insertHtml,
  replaceElement, removeElement, addLink, getElementHtml, buildPageSummary,
} from "@/lib/utils/html-mutations";
import { BLOCK_FIELD_KEYS } from "@/lib/types/builder";
import type { Block, BlockType, BlockData } from "@/lib/types/builder";

/** Keys in `data` that don't exist on this block type's data shape — passing one
 * of these silently does nothing (the real field keeps its default), so callers
 * must strip them and tell the model what the real field names are. */
function unknownBlockFields(type: BlockType, data: Record<string, unknown>): string[] {
  const validKeys = new Set(BLOCK_FIELD_KEYS[type] ?? []);
  return Object.keys(data).filter((k) => !validKeys.has(k));
}

const MAX_TURNS = 20;

/** Admin-editable overrides (see /admin -> AI Assistant Prompt / AI Assistant Model)
 * fall back to the hardcoded defaults when no override has been saved. platform_settings
 * has no RLS policies, so this must go through the service-role admin client. */
async function getPlatformAiSettings(): Promise<{ block: string; html: string; model: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("platform_settings")
    .select("ai_block_system_prompt, ai_html_system_prompt, ai_model")
    .maybeSingle();
  return {
    block: data?.ai_block_system_prompt || DEFAULT_SYSTEM_BLOCK,
    html: data?.ai_html_system_prompt || DEFAULT_SYSTEM_HTML,
    model: data?.ai_model || DEFAULT_AI_MODEL,
  };
}

function emit(controller: ReadableStreamDefaultController, event: object) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
}

async function executeBlockTool(
  blocks: Block[],
  name: string,
  input: Record<string, unknown>,
): Promise<{ blocks: Block[]; result: string; isError?: boolean }> {
  switch (name) {
    case "add_block": {
      const type = input.type as BlockType;
      const overrides = (input.data_overrides as Record<string, unknown>) ?? {};
      const badKeys = unknownBlockFields(type, overrides);
      const cleanOverrides = Object.fromEntries(Object.entries(overrides).filter(([k]) => !badKeys.includes(k)));
      const newBlocks = addBlock(blocks, type, input.after_block_id as string | undefined, cleanOverrides as Partial<BlockData>);
      const added = newBlocks.find((b) => !blocks.some((ob) => ob.id === b.id));
      if (badKeys.length > 0) {
        return {
          blocks: newBlocks,
          result: `Added ${type} block (id: ${added?.id}), but these fields don't exist on a "${type}" block and were ignored: ${badKeys.join(", ")}. Valid fields for "${type}" are: ${BLOCK_FIELD_KEYS[type].join(", ")}. Call update_block_data on block ${added?.id} with the correct field names to actually set that content.`,
          isError: true,
        };
      }
      return { blocks: newBlocks, result: `Added ${type} block.` };
    }
    case "update_block_data": {
      const blockId = input.block_id as string;
      const target = blocks.find((b) => b.id === blockId);
      if (!target) return { blocks, result: `No block found with id ${blockId}.`, isError: true };
      const data = (input.data as Record<string, unknown>) ?? {};
      const badKeys = unknownBlockFields(target.type, data);
      const cleanData = Object.fromEntries(Object.entries(data).filter(([k]) => !badKeys.includes(k)));
      const newBlocks = updateBlockData(blocks, blockId, cleanData as Partial<BlockData>);
      if (badKeys.length > 0) {
        return {
          blocks: newBlocks,
          result: `Updated block, but these fields don't exist on a "${target.type}" block and were ignored: ${badKeys.join(", ")}. Valid fields for "${target.type}" are: ${BLOCK_FIELD_KEYS[target.type].join(", ")}.`,
          isError: true,
        };
      }
      return { blocks: newBlocks, result: "Updated block data." };
    }
    case "move_block": {
      const newBlocks = moveBlock(blocks, input.block_id as string, input.target_index as number);
      return { blocks: newBlocks, result: `Moved block to position ${input.target_index}.` };
    }
    case "remove_block": {
      const newBlocks = removeBlock(blocks, input.block_id as string);
      return { blocks: newBlocks, result: "Removed block." };
    }
    case "duplicate_block": {
      const newBlocks = duplicateBlock(blocks, input.block_id as string);
      return { blocks: newBlocks, result: "Duplicated block." };
    }
    default:
      return { blocks, result: `Unknown tool: ${name}`, isError: true };
  }
}

async function executeHtmlTool(
  html: string,
  name: string,
  input: Record<string, unknown>,
): Promise<{ html: string; result: string }> {
  switch (name) {
    case "set_text_content":
      return { html: setTextContent(html, input.selector as string, input.new_text as string), result: "Text updated." };
    case "set_attribute":
      return { html: setAttribute(html, input.selector as string, input.attribute as string, input.value as string), result: "Attribute set." };
    case "set_inline_style":
      return { html: setInlineStyle(html, input.selector as string, input.style_properties as Record<string, string>), result: "Style applied." };
    case "insert_html":
      return {
        html: insertHtml(html, input.html as string, input.position as "after_selector" | "before_selector" | "append_to_body" | "prepend_to_body", input.selector as string | undefined),
        result: "HTML inserted.",
      };
    case "replace_element":
      return { html: replaceElement(html, input.selector as string, input.new_html as string), result: "Element replaced." };
    case "remove_element":
      return { html: removeElement(html, input.selector as string), result: "Element removed." };
    case "add_link":
      return { html: addLink(html, input.text_to_link as string, input.href as string), result: "Link added." };
    case "get_element_html": {
      const elementHtml = getElementHtml(html, input.selector as string);
      return { html, result: elementHtml ?? "Element not found." };
    }
    default:
      return { html, result: `Unknown tool: ${name}` };
  }
}

export async function POST(request: NextRequest) {
  // Auth + access check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_assistant_enabled")
    .eq("id", user.id)
    .single();

  if (!profile?.ai_assistant_enabled) {
    return NextResponse.json({ error: "AI assistant not enabled for this account" }, { status: 403 });
  }

  const body = await request.json() as {
    editorType: "block" | "html";
    messages: Anthropic.MessageParam[];
    blocks?: Block[];
    html?: string;
    pageTitle?: string;
  };

  const { editorType, messages, pageTitle = "this page" } = body;
  const tools = editorType === "block" ? BLOCK_TOOLS : HTML_TOOLS;
  const aiSettings = await getPlatformAiSettings();
  const system = editorType === "block"
    ? `${aiSettings.block}\nPage title: ${pageTitle}`
    : (() => {
        const summary = body.html ? buildPageSummary(body.html) : "";
        return `${aiSettings.html}\nPage title: ${pageTitle}\n\nPage structure:\n${summary}`;
      })();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  let workingBlocks: Block[] = JSON.parse(JSON.stringify(body.blocks ?? []));
  let workingHtml: string = body.html ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const conversationMessages = [...messages];
      let turns = 0;

      try {
        while (turns < MAX_TURNS) {
          turns++;
          const messageStream = anthropic.messages.stream({
            model: aiSettings.model,
            max_tokens: 4096,
            system,
            tools,
            messages: conversationMessages,
          });

          // Stream text chunks to the client in real time
          messageStream.on("text", (text) => {
            emit(controller, { type: "text", content: text });
          });

          const message = await messageStream.finalMessage();

          // Add assistant's full response to conversation history
          conversationMessages.push({ role: "assistant", content: message.content });

          if (message.stop_reason !== "tool_use") break;

          // Execute all tool calls and collect results
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of message.content) {
            if (block.type !== "tool_use") continue;
            const input = block.input as Record<string, unknown>;
            emit(controller, { type: "tool_call", name: block.name, label: toolCallLabel(block.name, input) });

            let resultText: string;
            let isError = false;
            if (editorType === "block") {
              const { blocks: next, result, isError: err } = await executeBlockTool(workingBlocks, block.name, input);
              workingBlocks = next;
              resultText = result;
              isError = err ?? false;
              emit(controller, { type: "state_update", blocks: workingBlocks });
            } else {
              const { html: next, result } = await executeHtmlTool(workingHtml, block.name, input);
              workingHtml = next;
              resultText = result;
              // Only emit state update for mutating tools (not get_element_html)
              if (block.name !== "get_element_html") {
                emit(controller, { type: "state_update", html: workingHtml });
              }
            }
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultText, is_error: isError });
          }

          conversationMessages.push({ role: "user", content: toolResults });
        }

        // Emit final state so client can sync definitively
        if (editorType === "block") {
          emit(controller, { type: "final_state", blocks: workingBlocks });
        } else {
          emit(controller, { type: "final_state", html: workingHtml });
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
