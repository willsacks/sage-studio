"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Plus, Check, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  updateContact, deleteContact,
  createStage, updateStage, deleteStage, reorderStages,
  createTag, updateTag, deleteTag, setContactTags,
} from "@/lib/actions/pipeline";
import type { Stage, Contact, Tag } from "@/app/(dashboard)/pipeline/page";

interface Props {
  contact: Contact | null;
  stages: Stage[];
  tags: Tag[];
  onClose: () => void;
  onContactDeleted: (id: string) => void;
  onContactUpdated: (contact: Contact) => void;
  onStageCreated: (stage: Stage) => void;
  onStageUpdated: (stage: Stage) => void;
  onStageDeleted: (id: string) => void;
  onStagesReordered: (stages: Stage[]) => void;
  onTagCreated: (tag: Tag) => void;
  onTagUpdated: (tag: Tag) => void;
  onTagDeleted: (id: string) => void;
  onContactTagsChanged: (contactId: string, tagIds: string[]) => void;
}

const PRESET_COLORS = [
  "#64748B", "#8B5CF6", "#F59E0B", "#F97316", "#10B981",
  "#3B82F6", "#EC4899", "#EF4444", "#06B6D4", "#84CC16",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
          style={{ backgroundColor: c, outline: value === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
        />
      ))}
    </div>
  );
}

// ── Stage Manager ─────────────────────────────────────────────────────────────

function SortableStageRow({
  stage, editing, editName, editColor, pending,
  setEditName, setEditColor, setEditing, onEditSave, onDelete,
}: {
  stage: Stage; editing: string | null; editName: string; editColor: string; pending: boolean;
  setEditName: (v: string) => void; setEditColor: (v: string) => void;
  setEditing: (id: string | null) => void;
  onEditSave: (id: string) => void; onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  if (editing === stage.id) {
    return (
      <div ref={setNodeRef} style={style} className="border border-[var(--border)] rounded-lg p-3 space-y-2">
        <input
          className="w-full text-sm bg-[var(--input)] border border-[var(--border)] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onEditSave(stage.id); if (e.key === "Escape") setEditing(null); }}
          autoFocus
        />
        <ColorPicker value={editColor} onChange={setEditColor} />
        <div className="flex gap-2">
          <button type="button" onClick={() => onEditSave(stage.id)} disabled={pending}
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50">
            <Check size={12} /> Save
          </button>
          <button type="button" onClick={() => setEditing(null)}
            className="text-xs px-3 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => onDelete(stage.id)} disabled={pending}
            className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 rounded-lg hover:bg-[var(--accent)] transition-colors group">
      <button type="button" {...attributes} {...listeners}
        className="p-2 cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        tabIndex={-1}>
        <GripVertical size={14} />
      </button>
      <button type="button"
        onClick={() => { setEditing(stage.id); setEditName(stage.name); setEditColor(stage.color); }}
        className="flex-1 flex items-center gap-2 px-2 py-2 text-left">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-sm flex-1">{stage.name}</span>
        <span className="text-xs text-[var(--muted-foreground)]">Edit</span>
      </button>
    </div>
  );
}

function StageManager({
  stages, onStageCreated, onStageUpdated, onStageDeleted, onStagesReordered,
}: Pick<Props, "stages" | "onStageCreated" | "onStageUpdated" | "onStageDeleted" | "onStagesReordered">) {
  const [orderedStages, setOrderedStages] = useState<Stage[]>(stages);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => { setOrderedStages(stages); }, [stages]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedStages.findIndex((s) => s.id === active.id);
    const newIndex = orderedStages.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(orderedStages, oldIndex, newIndex).map((s, i) => ({ ...s, position: i }));
    setOrderedStages(reordered);
    onStagesReordered(reordered);
    startTransition(async () => { await reorderStages(reordered.map((s) => s.id)); });
  }

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createStage(newName, newColor);
      if (res.stage) {
        onStageCreated(res.stage as unknown as Stage);
        setNewName(""); setNewColor(PRESET_COLORS[0]); setAdding(false);
      }
    });
  }

  function handleEditSave(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      await updateStage(id, editName, editColor);
      onStageUpdated({ ...orderedStages.find((s) => s.id === id)!, name: editName, color: editColor });
      setEditing(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteStage(id); onStageDeleted(id); });
  }

  return (
    <div className="space-y-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {orderedStages.map((stage) => (
            <SortableStageRow key={stage.id} stage={stage} editing={editing} editName={editName} editColor={editColor}
              pending={pending} setEditName={setEditName} setEditColor={setEditColor} setEditing={setEditing}
              onEditSave={handleEditSave} onDelete={handleDelete} />
          ))}
        </SortableContext>
      </DndContext>
      {adding ? (
        <div className="border border-[var(--border)] rounded-lg p-3 space-y-2 mt-2">
          <input className="w-full text-sm bg-[var(--input)] border border-[var(--border)] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="Stage name" value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }} autoFocus />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={pending || !newName.trim()}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50">
              <Check size={12} /> Add
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="text-xs px-3 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--muted-foreground)] transition-colors text-sm mt-2">
          <Plus size={14} /> Add stage
        </button>
      )}
    </div>
  );
}

// ── Tag Manager ───────────────────────────────────────────────────────────────

function TagManager({
  tags, onTagCreated, onTagUpdated, onTagDeleted,
}: Pick<Props, "tags" | "onTagCreated" | "onTagUpdated" | "onTagDeleted">) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[2]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createTag(newName, newColor);
      if (res.tag) {
        onTagCreated(res.tag as unknown as Tag);
        setNewName(""); setNewColor(PRESET_COLORS[2]); setAdding(false);
      }
    });
  }

  function handleEditSave(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      await updateTag(id, editName, editColor);
      onTagUpdated({ ...tags.find((t) => t.id === id)!, name: editName, color: editColor });
      setEditing(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteTag(id); onTagDeleted(id); });
  }

  return (
    <div className="space-y-1">
      {tags.length === 0 && !adding && (
        <p className="text-sm text-[var(--muted-foreground)] px-3 py-2">
          No tags yet. Tags let you group contacts by offer or project type.
        </p>
      )}
      {tags.map((tag) =>
        editing === tag.id ? (
          <div key={tag.id} className="border border-[var(--border)] rounded-lg p-3 space-y-2">
            <input className="w-full text-sm bg-[var(--input)] border border-[var(--border)] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={editName} onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(tag.id); if (e.key === "Escape") setEditing(null); }} autoFocus />
            <ColorPicker value={editColor} onChange={setEditColor} />
            <div className="flex gap-2">
              <button type="button" onClick={() => handleEditSave(tag.id)} disabled={pending}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50">
                <Check size={12} /> Save
              </button>
              <button type="button" onClick={() => setEditing(null)}
                className="text-xs px-3 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => handleDelete(tag.id)} disabled={pending}
                className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ) : (
          <button key={tag.id} type="button"
            onClick={() => { setEditing(tag.id); setEditName(tag.name); setEditColor(tag.color); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--accent)] transition-colors text-left">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
            <span className="text-sm flex-1">{tag.name}</span>
            <span className="text-xs text-[var(--muted-foreground)]">Edit</span>
          </button>
        )
      )}
      {adding ? (
        <div className="border border-[var(--border)] rounded-lg p-3 space-y-2 mt-2">
          <input className="w-full text-sm bg-[var(--input)] border border-[var(--border)] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="e.g. Path of Soul, Intro to Production"
            value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }} autoFocus />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={pending || !newName.trim()}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50">
              <Check size={12} /> Add
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="text-xs px-3 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--muted-foreground)] transition-colors text-sm mt-2">
          <Plus size={14} /> Add tag
        </button>
      )}
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function ContactDrawer({
  contact, stages, tags, onClose,
  onContactDeleted, onContactUpdated,
  onStageCreated, onStageUpdated, onStageDeleted, onStagesReordered,
  onTagCreated, onTagUpdated, onTagDeleted, onContactTagsChanged,
}: Props) {
  const [tab, setTab] = useState<"contact" | "stages" | "tags">("contact");
  const [name, setName] = useState(contact?.name ?? "");
  const [stageId, setStageId] = useState<string | null>(contact?.stage_id ?? null);
  const [contactTagIds, setContactTagIds] = useState<string[]>(contact?.tag_ids ?? []);
  const [nextAction, setNextAction] = useState(contact?.next_action ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [collaborators, setCollaborators] = useState(contact?.collaborators ?? "");
  const [nextSession, setNextSession] = useState(contact?.next_session ?? "");
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(contact?.name ?? "");
    setStageId(contact?.stage_id ?? null);
    setContactTagIds(contact?.tag_ids ?? []);
    setNextAction(contact?.next_action ?? "");
    setNotes(contact?.notes ?? "");
    setCollaborators(contact?.collaborators ?? "");
    setNextSession(contact?.next_session ?? "");
    setConfirmDelete(false);
    setTab("contact");
  }, [contact?.id]);

  function save() {
    if (!contact) return;
    startTransition(async () => {
      await updateContact(contact.id, {
        name, stage_id: stageId, next_action: nextAction || null,
        notes, collaborators, next_session: nextSession || null,
      });
      onContactUpdated({ ...contact, name, stage_id: stageId, next_action: nextAction || null, notes, collaborators, next_session: nextSession || null });
    });
  }

  function toggleTag(tagId: string) {
    if (!contact) return;
    const newTagIds = contactTagIds.includes(tagId)
      ? contactTagIds.filter((id) => id !== tagId)
      : [...contactTagIds, tagId];
    setContactTagIds(newTagIds);
    onContactTagsChanged(contact.id, newTagIds);
    startTransition(async () => { await setContactTags(contact.id, newTagIds); });
  }

  function handleDelete() {
    if (!contact) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(async () => {
      await deleteContact(contact.id);
      onContactDeleted(contact.id);
      onClose();
    });
  }

  return (
    <AnimatePresence>
      {contact && (
        <>
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

          <motion.div key="drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[var(--card)] shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex gap-1 text-sm">
                {(["contact", "stages", "tags"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-3 py-1 rounded-md transition-colors capitalize ${tab === t ? "bg-[var(--accent)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--muted-foreground)]">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {tab === "contact" && (
                <>
                  {/* Name */}
                  <div>
                    <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} onBlur={save}
                      className="w-full text-xl font-semibold bg-transparent border-b-2 border-transparent focus:border-[var(--primary)] focus:outline-none transition-colors py-1"
                      placeholder="Contact name" />
                  </div>

                  {/* Next Action */}
                  <div className="bg-[var(--accent)] rounded-xl px-4 py-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5 block">Next Action</label>
                    <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} onBlur={save}
                      placeholder="What needs to happen next?"
                      className="w-full text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-foreground)]" />
                  </div>

                  {/* Stage */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 block">Stage</label>
                    <div className="flex flex-wrap gap-2">
                      {stages.map((stage) => (
                        <button key={stage.id} type="button"
                          onClick={() => {
                            setStageId(stage.id);
                            if (!contact) return;
                            startTransition(async () => {
                              await updateContact(contact.id, { stage_id: stage.id });
                              onContactUpdated({ ...contact, name, stage_id: stage.id, next_action: nextAction || null, notes, collaborators, next_session: nextSession || null });
                            });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                          style={stageId === stage.id
                            ? { backgroundColor: stage.color, borderColor: stage.color, color: "#fff" }
                            : { borderColor: stage.color, color: stage.color, backgroundColor: `${stage.color}15` }}>
                          {stageId === stage.id && <Check size={11} />}
                          {stage.name}
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => {
                          setStageId(null);
                          if (!contact) return;
                          startTransition(async () => {
                            await updateContact(contact.id, { stage_id: null });
                            onContactUpdated({ ...contact, name, stage_id: null, next_action: nextAction || null, notes, collaborators, next_session: nextSession || null });
                          });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border border-[var(--border)] ${stageId === null ? "bg-[var(--muted)] font-semibold" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}>
                        None
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 block">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const active = contactTagIds.includes(tag.id);
                          return (
                            <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                              style={active
                                ? { backgroundColor: tag.color, borderColor: tag.color, color: "#fff" }
                                : { borderColor: tag.color, color: tag.color, backgroundColor: `${tag.color}15` }}>
                              {active && <Check size={11} />}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Collaborators */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 block">Collaborators</label>
                    <input value={collaborators} onChange={(e) => setCollaborators(e.target.value)} onBlur={save}
                      placeholder="e.g. with Sean, mixed by Jahleel"
                      className="w-full text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:text-[var(--muted-foreground)]" />
                  </div>

                  {/* Next session */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 block">Next Session</label>
                    <input type="date" value={nextSession} onChange={(e) => setNextSession(e.target.value)} onBlur={save}
                      className="w-full text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 block">Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={save} rows={5}
                      placeholder="Project notes, references, ideas..."
                      className="w-full text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:text-[var(--muted-foreground)] resize-none" />
                  </div>

                  {/* Delete */}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <button type="button" onClick={handleDelete} disabled={pending}
                      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${confirmDelete ? "bg-[var(--destructive)] text-white" : "text-[var(--destructive)] hover:bg-[var(--destructive)]/10"}`}>
                      <Trash2 size={14} />
                      {confirmDelete ? "Confirm delete" : "Delete contact"}
                    </button>
                    {confirmDelete && (
                      <button type="button" onClick={() => setConfirmDelete(false)}
                        className="ml-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}

              {tab === "stages" && (
                <StageManager stages={stages} onStageCreated={onStageCreated} onStageUpdated={onStageUpdated}
                  onStageDeleted={onStageDeleted} onStagesReordered={onStagesReordered} />
              )}

              {tab === "tags" && (
                <TagManager tags={tags} onTagCreated={onTagCreated} onTagUpdated={onTagUpdated} onTagDeleted={onTagDeleted} />
              )}
            </div>

            {pending && (
              <div className="px-5 py-2 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                Saving…
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
