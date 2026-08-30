"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Check, Square } from "lucide-react";
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

const THINKING_PHRASES = [
  "Thinking...",
  "Looking through your transactions...",
  "Reviewing your categories...",
  "Cross-checking existing rules...",
  "Working on it...",
];

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  // Splits on **bold** and `code` spans, keeping the delimiters via the
  // capture group so they land in the output array alongside plain text.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key} className="px-1 py-0.5 rounded bg-[var(--muted)] text-[0.8em]">{part.slice(1, -1)}</code>;
    }
    return part ? <span key={key}>{part}</span> : null;
  });
}

/** Minimal markdown rendering for the assistant's text — **bold**, `code`,
 * and "- "/"* " bullet lines, the only formatting the system prompt's own
 * summaries actually produce (reported live: responses were showing raw
 * "**Rule created**" asterisks instead of bold text). Deliberately not
 * react-markdown — this codebase has no markdown-rendering dependency at
 * all yet, and three formatting rules didn't seem worth introducing one for. */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
        const content = bulletMatch ? bulletMatch[1] : line;
        return (
          <span key={i} className={bulletMatch ? "block pl-3.5 relative before:content-['•'] before:absolute before:left-0" : "block"}>
            {content ? renderInlineMarkdown(content, `l${i}`) : " "}
          </span>
        );
      })}
    </>
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
  const [thinkingPhraseIndex, setThinkingPhraseIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const manualCancelRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cycles a rotating "still doing something" phrase the whole time nothing
  // concrete has arrived yet (no tool call, no text) — requested explicitly:
  // a silent multi-second gap before the first token/tool call reads as
  // stuck even though it's normal Anthropic API latency, and a single static
  // "thinking" label doesn't convey that. Deliberately superfluous — none of
  // these phrases reflect real backend state, they exist purely so the UI
  // doesn't look abandoned. Resets to the first phrase on every new message
  // so a quick response doesn't visibly cycle at all.
  useEffect(() => {
    if (!isStreaming) { setThinkingPhraseIndex(0); return; }
    const interval = setInterval(() => setThinkingPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length), 1500);
    return () => clearInterval(interval);
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
    manualCancelRef.current = false;
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
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      let content: string;
      if (isAbort && manualCancelRef.current) {
        content = "Stopped. Anything it already did before you cancelled is saved — check the Transactions tab and use the pencil icon on any row to fix or undo a wrong categorization.";
      } else if (isAbort) {
        content = "This stopped responding (possibly because the app was backgrounded) and was cancelled automatically. Anything it already did is saved — try again to pick up where it left off.";
      } else {
        content = "Network error. Please try again.";
      }
      setMessages((prev) => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, parts: [...(m.parts ?? []), { type: "text", content }], isStreaming: false }
          : m
      ));
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      if (actedAtAll) onCategorized();
    }
  }

  // The AI's tool calls execute real, persisted writes as they happen (real
  // categorizations, real new accounts/rules) — reported live: watching it
  // make several wrong categorizations in a row with no way to stop it.
  // Aborting the fetch alone would only stop the browser from *watching*;
  // the route checks request.signal between transactions/tool calls and
  // stops making further writes once it sees the client disconnected, so
  // this actually halts the in-progress work, not just the UI.
  function handleCancel() {
    manualCancelRef.current = true;
    abortRef.current?.abort();
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
                        <div key={j} className="rounded-xl px-3 py-2 text-sm leading-relaxed bg-[var(--card)] border border-[var(--border)]">
                          <MarkdownText text={part.content} />
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
                      <span className="text-xs text-[var(--muted-foreground)]">{THINKING_PHRASES[thinkingPhraseIndex]}</span>
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
          {isStreaming ? (
            <button
              type="button"
              onClick={handleCancel}
              title="Stop"
              className="flex-shrink-0 h-9 w-9 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 flex items-center justify-center"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex-shrink-0 h-9 w-9 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
