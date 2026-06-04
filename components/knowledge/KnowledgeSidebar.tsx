"use client";

import { useState, useTransition } from "react";
import { Search, ChevronDown, ChevronRight, Plus, GripVertical, Check, X, Pencil, Trash2 } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CELL_COLORS } from "@/components/process-game/Cell";
import { createSection, updateSection, deleteSection, reorderSections, createEntry } from "@/lib/actions/knowledge";
import type { KnowledgeSection, KnowledgeEntry } from "@/app/(dashboard)/knowledge/page";

interface Props {
  sections: KnowledgeSection[];
  entries: KnowledgeEntry[];
  activeEntryId: string | null;
  searchQuery: string;
  collapsedSections: Set<string>;
  onSearchChange: (q: string) => void;
  onSelectEntry: (id: string) => void;
  onToggleCollapse: (sectionId: string) => void;
  onSectionCreated: (s: KnowledgeSection) => void;
  onSectionUpdated: (s: KnowledgeSection) => void;
  onSectionDeleted: (id: string) => void;
  onSectionsReordered: (sections: KnowledgeSection[]) => void;
  onEntryCreated: (e: KnowledgeEntry) => void;
}

// ── Sortable section row ──────────────────────────────────────────────────────

function SortableSectionRow({
  section,
  entries,
  activeEntryId,
  collapsed,
  onToggleCollapse,
  onSelectEntry,
  onSectionUpdated,
  onSectionDeleted,
  onEntryCreated,
}: {
  section: KnowledgeSection;
  entries: KnowledgeEntry[];
  activeEntryId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectEntry: (id: string) => void;
  onSectionUpdated: (s: KnowledgeSection) => void;
  onSectionDeleted: (id: string) => void;
  onEntryCreated: (e: KnowledgeEntry) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [, startTransition] = useTransition();

  function handleRenameBlur() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== section.title) {
      startTransition(async () => {
        await updateSection(section.id, { title: trimmed });
        onSectionUpdated({ ...section, title: trimmed });
      });
    } else {
      setEditTitle(section.title);
    }
    setEditing(false);
  }

  function handleAddEntry() {
    setAddingEntry(true);
    startTransition(async () => {
      const res = await createEntry(section.id);
      if (res?.entry) {
        onEntryCreated(res.entry as unknown as KnowledgeEntry);
        onSelectEntry(res.entry.id);
      }
      setAddingEntry(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSection(section.id);
      onSectionDeleted(section.id);
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="select-none"
    >
      {/* Section header */}
      <div className="group flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical size={12} />
        </button>

        {/* Collapse toggle + colored dot + title */}
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: section.color }}
          />
          {section.emoji && <span className="text-sm leading-none flex-shrink-0">{section.emoji}</span>}
          {editing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameBlur();
                if (e.key === "Escape") { setEditTitle(section.title); setEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 text-xs font-semibold bg-transparent focus:outline-none border-b border-[var(--border)]"
            />
          ) : (
            <span className="flex-1 min-w-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] truncate">
              {section.title}
            </span>
          )}
          {entries.length > 0 && (
            <span className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0">{entries.length}</span>
          )}
          {collapsed ? (
            <ChevronRight size={12} className="flex-shrink-0 text-[var(--muted-foreground)]" />
          ) : (
            <ChevronDown size={12} className="flex-shrink-0 text-[var(--muted-foreground)]" />
          )}
        </button>

        {/* Actions (shown on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="p-0.5 text-red-500 hover:text-red-600"
                title="Confirm delete"
              >
                <Check size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X size={11} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); setEditTitle(section.title); }}
                className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Rename section"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="p-0.5 text-[var(--muted-foreground)] hover:text-red-500"
                title="Delete section"
              >
                <Trash2 size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddEntry(); }}
                disabled={addingEntry}
                className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                title="New entry"
              >
                <Plus size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Entry list */}
      {!collapsed && (
        <div className="ml-3 space-y-0.5 mb-1">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              active={entry.id === activeEntryId}
              onClick={() => onSelectEntry(entry.id)}
            />
          ))}
          {entries.length === 0 && (
            <button
              onClick={handleAddEntry}
              disabled={addingEntry}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--muted-foreground)]/60 hover:text-[var(--muted-foreground)] italic"
            >
              {addingEntry ? "Creating…" : "No entries — click + to add one"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────

function EntryRow({ entry, active, onClick }: { entry: KnowledgeEntry; active: boolean; onClick: () => void }) {
  const preview = entry.body.split("\n").find((l) => l.trim()) ?? "";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        active ? "bg-[var(--accent)]" : "hover:bg-[var(--accent)]/60"
      }`}
    >
      <p className="text-sm font-medium truncate text-[var(--foreground)]">{entry.title}</p>
      {preview && (
        <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">{preview}</p>
      )}
    </button>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function KnowledgeSidebar({
  sections,
  entries,
  activeEntryId,
  searchQuery,
  collapsedSections,
  onSearchChange,
  onSelectEntry,
  onToggleCollapse,
  onSectionCreated,
  onSectionUpdated,
  onSectionDeleted,
  onSectionsReordered,
  onEntryCreated,
}: Props) {
  const [addingSection, setAddingSection] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newColor, setNewColor] = useState(CELL_COLORS[1]);
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, position: i }));
    onSectionsReordered(reordered);
    startTransition(async () => { await reorderSections(reordered.map((s) => s.id)); });
  }

  function handleAddSection() {
    if (!newTitle.trim()) return;
    startTransition(async () => {
      const res = await createSection(newTitle.trim(), newEmoji.trim() || null, newColor);
      if (res?.section) {
        onSectionCreated(res.section as unknown as KnowledgeSection);
        setNewTitle("");
        setNewEmoji("");
        setNewColor(CELL_COLORS[1]);
        setAddingSection(false);
      }
    });
  }

  // Build section → entries map
  const entriesBySection: Record<string, KnowledgeEntry[]> = {};
  const unsectioned: KnowledgeEntry[] = [];
  for (const e of entries) {
    if (!e.section_id) {
      unsectioned.push(e);
    } else {
      (entriesBySection[e.section_id] ??= []).push(e);
    }
  }

  // Search mode: flat filtered list
  const isSearching = searchQuery.trim().length > 0;
  const searchResults = isSearching
    ? entries.filter((e) => {
        const q = searchQuery.toLowerCase();
        return e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q);
      })
    : [];
  const sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));

  return (
    <div className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-background)] flex flex-col">
      {/* Search */}
      <div className="flex-shrink-0 p-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
          <Search size={13} className="text-[var(--muted-foreground)] flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-foreground)]/60"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange("")} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {isSearching ? (
          <>
            {searchResults.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)] px-3 py-4 text-center">No results</p>
            )}
            {searchResults.map((entry) => {
              const sec = entry.section_id ? sectionById[entry.section_id] : null;
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => { onSearchChange(""); onSelectEntry(entry.id); }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      entry.id === activeEntryId ? "bg-[var(--accent)]" : "hover:bg-[var(--accent)]/60"
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{entry.title}</p>
                    {sec && (
                      <p className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: sec.color }} />
                        {sec.emoji ? `${sec.emoji} ` : ""}{sec.title}
                      </p>
                    )}
                  </button>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    entries={entriesBySection[section.id] ?? []}
                    activeEntryId={activeEntryId}
                    collapsed={collapsedSections.has(section.id)}
                    onToggleCollapse={() => onToggleCollapse(section.id)}
                    onSelectEntry={onSelectEntry}
                    onSectionUpdated={onSectionUpdated}
                    onSectionDeleted={onSectionDeleted}
                    onEntryCreated={onEntryCreated}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Unsectioned entries */}
            {unsectioned.length > 0 && (
              <div className="mt-2">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]/60">
                  Unsectioned
                </p>
                <div className="space-y-0.5">
                  {unsectioned.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      active={entry.id === activeEntryId}
                      onClick={() => onSelectEntry(entry.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {sections.length === 0 && unsectioned.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)] px-3 py-6 text-center leading-relaxed">
                Create your first section to start building your handbook.
              </p>
            )}
          </>
        )}
      </div>

      {/* New section form */}
      <div className="flex-shrink-0 p-2 border-t border-[var(--border)]">
        {addingSection ? (
          <div className="space-y-2 p-2 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
                placeholder="✦"
                className="w-10 text-center text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); if (e.key === "Escape") setAddingSection(false); }}
                placeholder="Section name…"
                className="flex-1 text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {CELL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: newColor === c ? `2px solid ${c}` : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleAddSection}
                disabled={!newTitle.trim()}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Check size={11} /> Add
              </button>
              <button
                onClick={() => setAddingSection(false)}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingSection(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
          >
            <Plus size={12} /> New Section
          </button>
        )}
      </div>
    </div>
  );
}
