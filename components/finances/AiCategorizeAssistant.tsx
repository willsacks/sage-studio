"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type AssistantPart =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; label: string }
  | { type: "action_result"; label: string };

interface Message {
  role: "user" | "assistant";
  content: string; // user messages only
  parts?: AssistantPart[]; // assistant messages only, in arrival order
  isStreaming?: boolean;
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

/** Chat-style assistant for turning a natural-language instruction
 * ("Acorns transactions are transfers to my Acorns account...") into real
 * categorization rules, applied immediately to matching existing
 * transactions. Mirrors components/site/AiChatPanel.tsx's streaming
 * fetch/parse pattern against app/api/finance/ai-categorize/route.ts. */
export function AiCategorizeAssistant({
  entityId,
  onClose,
  onCategorized,
}: {
  entityId: string;
  onClose: () => void;
  onCategorized: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stalled, setStalled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Any single stream event resets this — so a genuinely quiet stretch (the
  // model deciding its next move with no interim tool call) surfaces as
  // reassurance rather than looking indistinguishable from a hang.
  useEffect(() => {
    if (!isStreaming) { setStalled(false); return; }
    setStalled(false);
    const timer = setTimeout(() => setStalled(true), 15000);
    return () => clearTimeout(timer);
  }, [isStreaming, messages]);

  // Real recovery, not just the cosmetic "stalled" message above — reported
  // in production as the assistant "started working, then became
  // unresponsive to messages" on a phone. A backgrounded mobile tab can
  // suspend the fetch reader indefinitely with no error ever thrown, which
  // otherwise leaves isStreaming stuck true forever (input disabled, no way
  // to recover short of reloading the page). Checked on an interval rather
  // than a single timeout so it also catches a genuine mid-stream hang, not
  // just the resume-from-background case — and since browsers throttle
  // timers in backgrounded tabs, this fires almost immediately on foreground
  // resume if the backgrounded gap alone already exceeds the threshold.
  useEffect(() => {
    if (!isStreaming) return;
    const watchdog = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 90000) {
        abortRef.current?.abort();
      }
    }, 5000);
    return () => clearInterval(watchdog);
  }, [isStreaming]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", parts: [], isStreaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const conversationHistory = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.role === "assistant" ? (m.parts ?? []).filter((p) => p.type === "text").map((p) => p.content).join("") : m.content,
    }));

    let actedAtAll = false;
    lastActivityRef.current = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/finance/ai-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, message: text, conversationHistory }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, parts: [{ type: "text", content: `Error: ${err.error ?? "Something went wrong."}` }], isStreaming: false } : m
        ));
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        lastActivityRef.current = Date.now();
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
              if (last?.type === "text") {
                parts[parts.length - 1] = { ...last, content: last.content + (event.content as string) };
              } else {
                parts.push({ type: "text", content: event.content as string });
              }
              return { ...m, parts };
            }));
          } else if (event.type === "tool_call") {
            setMessages((prev) => prev.map((m, i) => {
              if (i !== prev.length - 1) return m;
              const parts = [...(m.parts ?? [])];
              const last = parts[parts.length - 1];
              // A running create_rule_and_apply call re-emits this event with
              // an updated "(n/total)" count as it works through matching
              // transactions — update that line in place instead of piling
              // up a new one per transaction.
              if (last?.type === "tool_call" && last.name === event.name) {
                parts[parts.length - 1] = { ...last, label: event.label as string };
              } else {
                parts.push({ type: "tool_call", name: event.name as string, label: event.label as string });
              }
              return { ...m, parts };
            }));
          } else if (event.type === "action_result") {
            actedAtAll = true;
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, parts: [...(m.parts ?? []), { type: "action_result", label: event.label as string }] } : m
            ));
          } else if (event.type === "error") {
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, parts: [...(m.parts ?? []), { type: "text", content: `Error: ${event.message as string}` }], isStreaming: false } : m
            ));
          } else if (event.type === "done") {
            setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, isStreaming: false } : m)));
          }
        }
      }
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setMessages((prev) => prev.map((m, i) =>
        i === prev.length - 1
          ? {
              ...m,
              parts: [...(m.parts ?? []), {
                type: "text",
                content: timedOut
                  ? "This stopped responding (possibly because the app was backgrounded) and was cancelled automatically. Anything it already did is saved — try again to pick up where it left off."
                  : "Network error. Please try again.",
              }],
              isStreaming: false,
            }
          : m
      ));
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      if (actedAtAll) onCategorized();
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg h-[32rem] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-[var(--border)]">
          <DialogTitle className="flex items-center gap-1.5"><Sparkles size={15} className="text-[var(--primary)]" /> AI Categorization Assistant</DialogTitle>
          <DialogDescription>
            Describe how to categorize your transactions — it'll create rules and apply them to what's already uncategorized.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-6 space-y-2">
              <Sparkles size={20} className="mx-auto text-[var(--muted-foreground)] opacity-30" />
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed max-w-sm mx-auto">
                Try something like: &quot;Anything with Anthropic in the name is an AI expense, and Acorns transactions are transfers to my Acorns account — categorize everything please.&quot;
              </p>
            </div>
          )}
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-[var(--primary)] text-[var(--primary-foreground)]">
                    {msg.content}
                  </div>
                </div>
              );
            }
            const parts = msg.parts ?? [];
            const lastPart = parts[parts.length - 1];
            const showTrailingThinking = msg.isStreaming && (!lastPart || lastPart.type === "tool_call");
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[90%] space-y-1.5 flex flex-col items-start">
                  {parts.map((part, j) => {
                    if (part.type === "text") {
                      return (
                        <div key={j} className="rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-[var(--card)] border border-[var(--border)]">
                          {part.content}
                          {j === parts.length - 1 && msg.isStreaming && <span className="inline-block w-1.5 h-3 bg-current opacity-60 ml-0.5 animate-pulse" />}
                        </div>
                      );
                    }
                    if (part.type === "action_result") {
                      return (
                        <div key={j} className="flex items-center gap-1.5 text-xs text-emerald-600 px-1">
                          <Check size={12} className="flex-shrink-0" /> {part.label}
                        </div>
                      );
                    }
                    return (
                      <div key={j} className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] px-1">
                        <Sparkles size={11} className="text-[var(--primary)] flex-shrink-0" /> {part.label}
                      </div>
                    );
                  })}
                  {showTrailingThinking && (
                    <div className="rounded-xl px-3 py-2 bg-[var(--card)] border border-[var(--border)] flex items-center gap-2">
                      <ThinkingDots />
                      {stalled && (
                        <span className="text-xs text-[var(--muted-foreground)]">Still working — larger batches can take a bit...</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex-shrink-0 border-t border-[var(--border)] p-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="Describe how to categorize your transactions..."
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="flex-shrink-0 h-9 w-9 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center disabled:opacity-50"
          >
            {isStreaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
