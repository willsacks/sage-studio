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
import type { Block, BlockType, BlockData } from "@/lib/types/builder";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 20;

const SYSTEM_BLOCK = `You are an AI design assistant built into Sage Studio, a website builder for independent artists.
Help artists create and improve their pages using the available tools. Be decisive — make changes directly without asking for confirmation on small, clear requests.
Describe what you're doing as you work ("Adding a hero section now...", "Updating the headline...").
Block types available: hero, text, image, feature_grid, testimonial, pricing_card, image_text, guarantee, cta_banner, video_embed, spacer, divider, application_form, simple_form, music_embed, album_showcase, discography.
Key block fields — hero: {headline, subheadline, height:"sm"|"md"|"lg"|"full", textAlign:"left"|"center"|"right", backgroundType:"image"|"video", overlay:boolean, ctaText, ctaLink}. text: {html:string}. cta_banner: {headline, ctaText, ctaLink}.`;

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
): Promise<{ blocks: Block[]; result: string }> {
  switch (name) {
    case "add_block": {
      const newBlocks = addBlock(
        blocks,
        input.type as BlockType,
        input.after_block_id as string | undefined,
        input.data_overrides as Partial<BlockData> | undefined,
      );
      return { blocks: newBlocks, result: `Added ${String(input.type)} block.` };
    }
    case "update_block_data": {
      const newBlocks = updateBlockData(blocks, input.block_id as string, input.data as Partial<BlockData>);
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
      return { blocks, result: `Unknown tool: ${name}` };
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
            if (editorType === "block") {
              const { blocks: next, result } = await executeBlockTool(workingBlocks, block.name, input);
              workingBlocks = next;
              resultText = result;
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
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultText });
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
