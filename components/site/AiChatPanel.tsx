"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, BrainCircuit, Sparkles } from "lucide-react";
import type { Block } from "@/lib/types/builder";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; label: string }[];
  isStreaming?: boolean;
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
}

export function AiChatPanel({
  editorType, aiEnabled, pageId, pageTitle, blocks, onBlocksUpdate, html, onHtmlUpdate,
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

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", toolCalls: [], isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    // Build the messages array for the API in the Anthropic format
    const history = [...messages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
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
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: `Error: ${err.error ?? "Something went wrong."}`, isStreaming: false } : m
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
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: m.content + (event.content as string) } : m
            ));
          } else if (event.type === "tool_call") {
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name: event.name as string, label: event.label as string }] }
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
                ? { ...m, content: (m.content || "") + `\n\nError: ${event.message as string}`, isStreaming: false }
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
          ? { ...m, content: "Network error. Please try again.", isStreaming: false }
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
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] space-y-1.5 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className={`rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]"
                }`}
              >
                {msg.content || (msg.isStreaming ? <span className="opacity-50">Thinking…</span> : null)}
                {msg.isStreaming && msg.content && (
                  <span className="inline-block w-1.5 h-3 bg-current opacity-60 ml-0.5 animate-pulse" />
                )}
              </div>
              {(msg.toolCalls?.length ?? 0) > 0 && (
                <div className="space-y-1 w-full">
                  {msg.toolCalls!.map((tc, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] px-1">
                      <Sparkles size={10} className="text-[var(--primary)] flex-shrink-0" />
                      {tc.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[var(--border)] p-3">
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
