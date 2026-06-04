"use client";

import { useState, useMemo } from "react";
import { KnowledgeSidebar } from "./KnowledgeSidebar";
import { EntryEditor } from "./EntryEditor";
import type { KnowledgeSection, KnowledgeEntry } from "@/app/(dashboard)/knowledge/page";

interface Props {
  sections: KnowledgeSection[];
  entries: KnowledgeEntry[];
}

export function KnowledgeView({ sections: initialSections, entries: initialEntries }: Props) {
  const [sections, setSections] = useState(initialSections);
  const [entries, setEntries] = useState(initialEntries);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) ?? null,
    [entries, activeEntryId]
  );

  function toggleCollapse(sectionId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  return (
    <div className="-mx-6 -my-8 flex h-screen overflow-hidden border-t border-[var(--border)]">
      <KnowledgeSidebar
        sections={sections}
        entries={entries}
        activeEntryId={activeEntryId}
        searchQuery={searchQuery}
        collapsedSections={collapsedSections}
        onSearchChange={setSearchQuery}
        onSelectEntry={setActiveEntryId}
        onToggleCollapse={toggleCollapse}
        onSectionCreated={(s) => setSections((prev) => [...prev, s])}
        onSectionUpdated={(s) => setSections((prev) => prev.map((x) => (x.id === s.id ? s : x)))}
        onSectionDeleted={(id) => {
          setSections((prev) => prev.filter((s) => s.id !== id));
          // orphan entries (DB already set section_id to null via ON DELETE SET NULL)
          setEntries((prev) => prev.map((e) => e.section_id === id ? { ...e, section_id: null } : e));
        }}
        onSectionsReordered={setSections}
        onEntryCreated={(e) => setEntries((prev) => [...prev, e])}
      />
      <EntryEditor
        entry={activeEntry}
        allSections={sections}
        onEntryUpdated={(updated) =>
          setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        }
        onEntryDeleted={(id) => {
          setEntries((prev) => prev.filter((e) => e.id !== id));
          setActiveEntryId(null);
        }}
      />
    </div>
  );
}
