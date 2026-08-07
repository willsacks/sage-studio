"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, BrainCircuit, Sparkles, MousePointerClick, X } from "lucide-react";
import type { Block } from "@/lib/types/builder";

// An assistant turn can interleave text and tool calls in any order (e.g.
// "Let me check..." -> reads a section -> "Now I'll center it" -> several
// style updates -> "Done!"). Modeling it as an ordered list of parts (instead
// of one big text blob plus a separate tool-call list) lets the UI show that
// real sequence as it happens, rather than clumping everything by kind.
type AssistantPart =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; label: string };

interface Message {
  role: "user" | "assistant";
  content: string; // user messages only
  parts?: AssistantPart[]; // assistant messages only, in arrival order
  isStreaming?: boolean;
  selectedContextLabel?: string; // user messages only — snapshot of what was selected when sent
}

/** Three-dot "typing" indicator — shown while the assistant is working and
 * hasn't streamed any text yet (tool-call-only turns can otherwise look idle
 * for several seconds even though tool calls are actively being made). */
function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

export interface AiChatPanelProps {
  editorType: "block" | "html";
  aiEnabled: boolean;
  pageId: string;
  pageTitle: string;
  // Block editor
  blocks?: Block[];
  onBlocksUpdate?: (blocks: Block[]) => void;
  // HTML editor
  html?: string;
  onHtmlUpdate?: (html: string) => void;
  // Selected element/block context — `key` is opaque here (a CSS selector for
  // the HTML editor, a block id for the block editor); shown as a persistent
  // chip and sent with every request until cleared.
  selectedContext?: { label: string; key: string } | null;
  onClearSelection?: () => void;
}

export function AiChatPanel({
  editorType, aiEnabled, pageId, pageTitle, blocks, onBlocksUpdate, html, onHtmlUpdate,
  selectedContext, onClearSelection,
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text, selectedContextLabel: selectedContext?.label };
    const assistantMsg: Message = { role: "assistant", content: "", parts: [], isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    // Build the messages array for the API in the Anthropic format — the API
    // only needs the assistant's text, not its tool-call parts (the server
    // already resolved those within that request's own tool loop).
    const history = [...messages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.role === "assistant"
        ? (m.parts ?? []).filter((p) => p.type === "text").map((p) => p.content).join("")
        : m.content,
    }));

    try {
      const res = await fetch("/api/ai-page-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorType,
          messages: history,
          pageTitle,
          blocks: editorType === "block" ? blocks : undefined,
          html: editorType === "html" ? html : undefined,
          selectedBlockId: editorType === "block" ? selectedContext?.key : undefined,
          selectedSelector: editorType === "html" ? selectedContext?.key : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, parts: [{ type: "text", content: `Error: ${err.error ?? "Something went wrong."}` }], isStreaming: false }
            : m
        ));
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.trim()) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === "text") {
            setMessages((prev) => prev.map((m, i) => {
              if (i !== prev.length - 1) return m;
              const parts = [...(m.parts ?? [])];
              const last = parts[parts.length - 1];
              // Consecutive text events are chunks of one continuous reply —
              // append to the running text part rather than starting a new one.
              if (last?.type === "text") {
                parts[parts.length - 1] = { ...last, content: last.content + (event.content as string) };
              } else {
                parts.push({ type: "text", content: event.content as string });
              }
              return { ...m, parts };
            }));
          } else if (event.type === "tool_call") {
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, parts: [...(m.parts ?? []), { type: "tool_call", name: event.name as string, label: event.label as string }] }
                : m
            ));
          } else if (event.type === "state_update" || event.type === "final_state") {
            if (editorType === "block" && event.blocks && onBlocksUpdate) {
              onBlocksUpdate(event.blocks as Block[]);
            } else if (editorType === "html" && event.html && onHtmlUpdate) {
              onHtmlUpdate(event.html as string);
            }
          } else if (event.type === "error") {
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, parts: [...(m.parts ?? []), { type: "text", content: `Error: ${event.message as string}` }], isStreaming: false }
                : m
            ));
          } else if (event.type === "done") {
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, isStreaming: false } : m
            ));
          }
        }
      }
    } catch (err) {
      setMessages((prev) => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, parts: [...(m.parts ?? []), { type: "text", content: "Network error. Please try again." }], isStreaming: false }
          : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }

  if (!aiEnabled) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 px-4 text-center">
        <BrainCircuit size={28} className="text-[var(--muted-foreground)] opacity-40" />
        <p className="text-sm text-[var(--muted-foreground)]">AI assistant coming soon</p>
        <p className="text-xs text-[var(--muted-foreground)] opacity-60">Ask your admin to enable it for your account.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)] flex-shrink-0">
        <Sparkles size={14} className="text-[var(--primary)]" />
        <span className="text-xs font-semibold text-[var(--foreground)]">AI Assistant</span>
        {isStreaming && <Loader2 size={12} className="animate-spin text-[var(--muted-foreground)]" />}
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-medium">Beta</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <BrainCircuit size={24} className="mx-auto text-[var(--muted-foreground)] opacity-30" />
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              {editorType === "block"
                ? "Tell me what you'd like to build. I can add blocks, rewrite text, rearrange sections, and more."
                : "Tell me what to change. I can edit text, update styles, add links, insert sections, and more."}
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex flex-col items-end gap-1">
                {msg.selectedContextLabel && (
                  <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] px-1">
                    <MousePointerClick size={10} className="text-[var(--primary)] flex-shrink-0" />
                    <span className="truncate max-w-[220px]">{msg.selectedContextLabel}</span>
                  </div>
                )}
                <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-[var(--primary)] text-[var(--primary-foreground)]">
                  {msg.content}
                </div>
              </div>
            );
          }

          const parts = msg.parts ?? [];
          const lastPart = parts[parts.length - 1];
          // Waiting for the next thing to arrive — either nothing has come in
          // yet, or the last thing was a tool call (no text to blink a cursor
          // onto) and the model is deciding what to do next.
          const showTrailingThinking = msg.isStreaming && (!lastPart || lastPart.type === "tool_call");

          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] space-y-1.5 items-start flex flex-col">
                {parts.map((part, j) =>
                  part.type === "text" ? (
                    <div
                      key={j}
                      className="rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]"
                    >
                      {part.content}
                      {j === parts.length - 1 && msg.isStreaming && (
                        <span className="inline-block w-1.5 h-3 bg-current opacity-60 ml-0.5 animate-pulse" />
                      )}
                    </div>
                  ) : (
                    <div key={j} className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] px-1">
                      <Sparkles size={10} className="text-[var(--primary)] flex-shrink-0" />
                      {part.label}
                    </div>
                  )
                )}
                {showTrailingThinking && (
                  <div className="rounded-xl px-3 py-2 bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]">
                    <ThinkingDots />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[var(--border)] p-3">
        {selectedContext && (
          <div className="flex items-center gap-1.5 mb-2 pl-2 pr-1 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-[11px]">
            <MousePointerClick size={11} className="flex-shrink-0" />
            <span className="flex-1 truncate font-medium">{selectedContext.label}</span>
            <button
              type="button"
              onClick={onClearSelection}
              title="Clear selection"
              className="p-0.5 rounded hover:bg-[var(--primary)]/15 flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder={isStreaming ? "Working on it…" : "Ask me to change anything…"}
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 disabled:opacity-50 leading-relaxed max-h-28 overflow-y-auto"
            style={{ minHeight: "36px" }}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="w-8 h-8 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {isStreaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </form>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5 text-center opacity-60">
          Changes appear live · Save when you&apos;re happy
        </p>
      </div>
    </div>
  );
}
