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
import { createClient } from "@/lib/supabase/server";
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

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 20;

const SYSTEM_BLOCK = `You are an AI design assistant built into Sage Studio, a website builder for independent artists.
Help artists create and improve their pages using the available tools. Be decisive — make changes directly without asking for confirmation on small, clear requests.
Describe what you're doing as you work ("Adding a hero section now...", "Updating the headline...").

RULES
- Field names below are exact and case-sensitive. A field name that isn't listed for that block type is silently ignored — the real field keeps its default placeholder text and your content never appears on the page. If a tool result tells you a field was ignored, immediately call update_block_data with the corrected field name — don't leave it wrong.
- Fully populate every block's data_overrides in the same add_block call that creates it. Don't add a block with defaults now and fill it in with a separate call later — and never leave placeholder content ("Feature One", "Describe the benefit of this feature...", "Your Compelling Headline Here") in the final result.
- If the page already has blocks when you start, edit and reuse them with update_block_data instead of adding duplicates — e.g. if there's already a hero block, update it rather than adding a second one.
- You have no way to source, generate, or upload real images. Never set backgroundType or an image field to "image" without also being given a real image URL by the user — leave backgroundType unset (a solid color background) and mention in your reply that they can drop in an image afterward.
- Vary section types for visual rhythm — don't stack multiple feature_grid blocks back to back. Write specific copy pulled from what the user actually told you, not generic filler ("Everything You Get", "Ready to Begin?") unless their own words suggest that tone.

BLOCK SCHEMA — exact data fields per block type ("?" = optional; everything else is expected)

hero: { headline, subheadline?, paragraph?, ctaText?, ctaLink?, overlay?:bool, height?:"sm"|"md"|"lg"|"full", textAlign?:"left"|"center"|"right", backgroundType?:"image"|"video", backgroundImage?, backgroundVideo? }

text: { content (an HTML string), alignment?:"left"|"center"|"right", size?:"sm"|"base"|"lg"|"xl", maxWidth?:bool }
  — the field is "content", not "html".

image: { image? (url), width:"full"|"wide"|"medium"|"small", alignment:"left"|"center"|"right", padding:"none"|"sm"|"md"|"lg", caption? }

feature_grid: { columns:2|3|4, heading?, subheading?, features:[{id, icon?, title, description}] }
  — the title fields are "heading"/"subheading", not "headline"/"subheadline". Always write real entries into "features" — never leave the default Feature One/Two/Three placeholders.

testimonial: { heading?, testimonials:[{id, quote, name, title?, avatar?}] }

pricing_card: { sectionHeading?, sectionSubheading?, footerText?, layout?:"center"|"left", tiers:[{id, heading?, badge?, price, originalPrice?, period?, description?, features:string[], ctaText, ctaLink?, highlight?:bool}] }
  — use "tiers" (an array), not top-level price/features fields — those are a legacy single-tier fallback the renderer no longer prefers.

image_text: { imagePosition:"left"|"right"|"centered", image?, heading?, subheading?, body, ctaText?, ctaLink? }
  — the fields are "heading"/"body", not "headline"/"text".

guarantee: { heading, body, icon? }
  — the fields are "heading"/"body", not "headline"/"text".

cta_banner: { heading, subheading?, ctaText, ctaLink?, background?:"gold"|"dark"|"brand" }

video_embed: { url, caption? }

spacer: { height:"sm"|"md"|"lg"|"xl" }

divider: { style:"line"|"dotted"|"gradient"|"ornament", width?:"full"|"centered" }

music_embed: { url, caption?, size?:"compact"|"full" }

album_showcase: { albumArt?, albumTitle, artistName?, releaseYear?, releaseType?:"album"|"ep"|"single"|"mixtape", description?, tracklist?:[{id, title, duration?}], streamingLinks?:[{id, platform, url}], layout?:"left"|"center" }

discography: { heading?, subheading?, columns?:2|3|4, releases:[{id, title, year?, type?:"album"|"ep"|"single"|"mixtape", url?, artwork?}] }

simple_form: { heading?, subheading?, fields?:[{id, type:"text"|"email"|"phone"|"textarea", label, placeholder?, required?:bool, halfWidth?:bool}], submitText?, successMessage?, notificationEmail? }

application_form: { welcomeTitle?, welcomeSubtitle?, welcomeButtonText?, questions?:[{id, type:"short_text"|"long_text"|"multiple_choice"|"select_multiple"|"email"|"phone"|"rating", label, description?, placeholder?, required?:bool, choices?:string[]}], thankYouTitle?, thankYouMessage?, submitButtonText? }`;

const SYSTEM_HTML = `You are an AI design assistant built into Sage Studio, a website builder for independent artists.
Help artists edit their imported HTML pages using the available tools. Make targeted, precise edits — preserve existing styles and class names unless asked to change them.
Use CSS selectors (tag, #id, .class, or combinations) to target elements. When you need to see a section's HTML before rewriting it, use get_element_html first.
Never add <script> tags — they are automatically stripped for security.
Describe what you're doing as you work ("Updating the heading...", "Changing the background color...").`;

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
  const system = editorType === "block"
    ? `${SYSTEM_BLOCK}\nPage title: ${pageTitle}`
    : (() => {
        const summary = body.html ? buildPageSummary(body.html) : "";
        return `${SYSTEM_HTML}\nPage title: ${pageTitle}\n\nPage structure:\n${summary}`;
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
            model: MODEL,
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
