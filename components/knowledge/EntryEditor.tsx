"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Loader2, Check, Trash2, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { updateEntry, deleteEntry } from "@/lib/actions/knowledge";
import type { KnowledgeSection, KnowledgeEntry } from "@/app/(dashboard)/knowledge/page";

interface Props {
  entry: KnowledgeEntry | null;
  allSections: KnowledgeSection[];
  onEntryUpdated: (entry: KnowledgeEntry) => void;
  onEntryDeleted: (id: string) => void;
}

export function EntryEditor({ entry, allSections, onEntryUpdated, onEntryDeleted }: Props) {
  const [localTitle, setLocalTitle] = useState(entry?.title ?? "");
  const [localBody, setLocalBody] = useState(entry?.body ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const entryRef = useRef(entry);
  entryRef.current = entry;

  // Reset local state when switching entries
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    clearTimeout(savedTimerRef.current);
    setLocalTitle(entry?.title ?? "");
    setLocalBody(entry?.body ?? "");
    setSaveStatus("idle");
    setConfirmDelete(false);
    if (entry && (entry.title === "Untitled" || entry.title === "")) {
      setTimeout(() => {
        titleRef.current?.select();
      }, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  function scheduleBodySave(newBody: string) {
    setLocalBody(newBody);
    if (!entry) return;
    setSaveStatus("saving");
    clearTimeout(saveTimerRef.current);
    clearTimeout(savedTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        await updateEntry(entry.id, { body: newBody });
        onEntryUpdated({ ...entry, body: newBody, updated_at: new Date().toISOString() });
        setSaveStatus("saved");
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      });
    }, 800);
  }

  function handleTitleBlur() {
    if (!entry) return;
    const trimmed = localTitle.trim() || "Untitled";
    if (trimmed !== entry.title) {
      startTransition(async () => {
        await updateEntry(entry.id, { title: trimmed });
        onEntryUpdated({ ...entry, title: trimmed, updated_at: new Date().toISOString() });
      });
    }
    if (!localTitle.trim()) setLocalTitle("Untitled");
  }

  function handleSectionChange(sectionId: string) {
    if (!entry) return;
    const newSectionId = sectionId === "__none__" ? null : sectionId;
    startTransition(async () => {
      await updateEntry(entry.id, { section_id: newSectionId });
      onEntryUpdated({ ...entry, section_id: newSectionId, updated_at: new Date().toISOString() });
    });
  }

  async function handleDelete() {
    if (!entry) return;
    await deleteEntry(entry.id);
    onEntryDeleted(entry.id);
  }

  const wordCount = localBody.trim()
    ? localBody.trim().split(/\s+/).filter(Boolean).length
    : 0;

  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
        <BookOpen size={44} className="text-[var(--muted-foreground)] opacity-20" />
        <div>
          <p className="text-base font-medium text-[var(--muted-foreground)]">Select an entry</p>
          <p className="text-sm text-[var(--muted-foreground)]/60 mt-1">
            Or create a new one in any section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-2.5 border-b border-[var(--border)] bg-[var(--background)]">
        {/* Section move */}
        <select
          value={entry.section_id ?? "__none__"}
          onChange={(e) => handleSectionChange(e.target.value)}
          className="text-xs bg-[var(--accent)] border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-[var(--foreground)] max-w-[160px] truncate"
        >
          <option value="__none__">Unsectioned</option>
          {allSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji ? `${s.emoji} ` : ""}{s.title}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {/* Word count */}
        {wordCount > 0 && (
          <span className="text-xs text-[var(--muted-foreground)]">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        )}

        {/* Save status */}
        <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 min-w-[80px] justify-end">
          {saveStatus === "saving" && (
            <><Loader2 size={11} className="animate-spin" /> Saving…</>
          )}
          {saveStatus === "saved" && (
            <><Check size={11} className="text-emerald-500" /> Saved</>
          )}
          {saveStatus === "idle" && entry.updated_at && (
            <>Saved {formatDistanceToNow(new Date(entry.updated_at), { addSuffix: true })}</>
          )}
        </span>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-500">Delete?</span>
            <button
              onClick={handleDelete}
              className="text-xs px-2 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete entry"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Title */}
      <input
        ref={titleRef}
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (document.querySelector("[data-entry-body]") as HTMLTextAreaElement)?.focus();
          }
        }}
        placeholder="Untitled"
        className="flex-shrink-0 w-full px-8 pt-8 pb-2 text-3xl font-bold bg-transparent focus:outline-none placeholder:text-[var(--muted-foreground)]/30 text-[var(--foreground)]"
      />

      {/* Body */}
      <textarea
        data-entry-body
        value={localBody}
        onChange={(e) => scheduleBodySave(e.target.value)}
        placeholder="Start writing…"
        className="flex-1 w-full px-8 py-4 text-base leading-relaxed bg-transparent focus:outline-none resize-none placeholder:text-[var(--muted-foreground)]/30 text-[var(--foreground)]"
      />
    </div>
  );
}
