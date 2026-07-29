"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Check } from "lucide-react";
import { saveAiPrompts } from "@/lib/actions/admin";

interface AiPromptEditorProps {
  initialBlockPrompt: string;
  initialHtmlPrompt: string;
  defaultBlockPrompt: string;
  defaultHtmlPrompt: string;
}

type Tab = "block" | "html";

export function AiPromptEditor({
  initialBlockPrompt,
  initialHtmlPrompt,
  defaultBlockPrompt,
  defaultHtmlPrompt,
}: AiPromptEditorProps) {
  const [tab, setTab] = useState<Tab>("block");
  const [blockPrompt, setBlockPrompt] = useState(initialBlockPrompt);
  const [htmlPrompt, setHtmlPrompt] = useState(initialHtmlPrompt);
  const [savedBlockPrompt, setSavedBlockPrompt] = useState(initialBlockPrompt);
  const [savedHtmlPrompt, setSavedHtmlPrompt] = useState(initialHtmlPrompt);
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  const value = tab === "block" ? blockPrompt : htmlPrompt;
  const setValue = tab === "block" ? setBlockPrompt : setHtmlPrompt;
  const defaultValue = tab === "block" ? defaultBlockPrompt : defaultHtmlPrompt;
  const isDirty = blockPrompt !== savedBlockPrompt || htmlPrompt !== savedHtmlPrompt;

  function handleSave() {
    startTransition(async () => {
      await saveAiPrompts(blockPrompt, htmlPrompt);
      setSavedBlockPrompt(blockPrompt);
      setSavedHtmlPrompt(htmlPrompt);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    });
  }

  function handleResetToDefault() {
    setValue(defaultValue);
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 pt-3">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("block")}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors ${
              tab === "block"
                ? "bg-[var(--accent)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Block Editor
          </button>
          <button
            onClick={() => setTab("html")}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors ${
              tab === "html"
                ? "bg-[var(--accent)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            HTML Editor
          </button>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <button
            onClick={handleResetToDefault}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
          >
            <RotateCcw size={11} /> Reset to default
          </button>
          <button
            onClick={handleSave}
            disabled={pending || !isDirty}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 transition-colors"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : justSaved ? <Check size={11} /> : null}
            {justSaved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        className="w-full h-96 px-4 py-3 text-xs font-mono leading-relaxed bg-transparent border-t border-[var(--border)] focus:outline-none resize-y"
      />
    </div>
  );
}
