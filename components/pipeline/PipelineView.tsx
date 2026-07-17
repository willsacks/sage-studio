"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Users, Calendar, ChevronRight, ChevronDown, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createContact, updateContact } from "@/lib/actions/pipeline";
import { ContactDrawer } from "./ContactDrawer";
import type { Stage, Contact, Tag } from "@/app/(dashboard)/pipeline/page";

interface Props {
  stages: Stage[];
  contacts: Contact[];
  tags: Tag[];
}

// ── Inline "add contact" row, reused both at the top of the page and inline
// under a specific stage header ──────────────────────────────────────────────

function AddContactRow({
  value, onChange, onSubmit, onCancel, pending,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void; pending: boolean;
}) {
  return (
    <div className="flex gap-2 items-center p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Artist or project name"
        className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-foreground)]"
      />
      <button
        onClick={onSubmit}
        disabled={pending || !value.trim()}
        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        Add
      </button>
      <button
        onClick={onCancel}
        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

export function PipelineView({ stages: initialStages, contacts: initialContacts, tags: initialTags }: Props) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [filterStageId, setFilterStageId] = useState<string | "all">("all");
  const [filterTagId, setFilterTagId] = useState<string | "all">("all");
  const [addingName, setAddingName] = useState("");
  // null = no add form open; "__global__" = the top-of-page button; otherwise
  // a stage id, for the inline "+" beside that stage's header.
  const [addingTarget, setAddingTarget] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  const filteredContacts = contacts
    .filter((c) => filterStageId === "all" || c.stage_id === filterStageId)
    .filter((c) => filterTagId === "all" || c.tag_ids.includes(filterTagId))
    .slice()
    .sort((a, b) => {
      const posA = a.stage_id ? (stageMap[a.stage_id]?.position ?? Infinity) : Infinity;
      const posB = b.stage_id ? (stageMap[b.stage_id]?.position ?? Infinity) : Infinity;
      return posA - posB;
    });

  const groups = useMemo(() => {
    const buckets = new Map<string, Contact[]>();
    for (const c of filteredContacts) {
      const key = c.stage_id ?? "__no_stage__";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(c);
    }
    // Show every stage (so the per-stage "+" is reachable even when a stage
    // has no contacts yet), plus a "No stage" bucket only when it's non-empty.
    const stageGroups = stages
      .filter((s) => filterStageId === "all" || filterStageId === s.id)
      .map((s) => ({ key: s.id, stage: s as Stage | null, contacts: buckets.get(s.id) ?? [] }));
    const noStageContacts = buckets.get("__no_stage__") ?? [];
    const noStageGroup = noStageContacts.length > 0
      ? [{ key: "__no_stage__", stage: null as Stage | null, contacts: noStageContacts }]
      : [];
    return [...stageGroups, ...noStageGroup]
      .sort((a, b) => (a.stage?.position ?? Infinity) - (b.stage?.position ?? Infinity));
  }, [filteredContacts, stages, filterStageId]);

  function toggleStage(key: string) {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function openAdd(target: string) {
    setAddingTarget(target);
    setAddingName("");
    setCollapsedStages((prev) => {
      if (!prev.has(target)) return prev;
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
  }

  function closeAdd() {
    setAddingTarget(null);
    setAddingName("");
  }

  function handleAdd() {
    if (!addingName.trim() || !addingTarget) return;
    const stageId = addingTarget === "__global__" ? (stages[0]?.id ?? null) : addingTarget;
    startTransition(async () => {
      const res = await createContact(addingName.trim(), stageId);
      if (res.contactId) {
        const newContact: Contact = {
          id: res.contactId,
          name: addingName.trim(),
          stage_id: stageId,
          notes: null,
          collaborators: null,
          next_session: null,
          next_action: null,
          tag_ids: [],
          created_at: new Date().toISOString(),
        };
        setContacts((prev) => [newContact, ...prev]);
        closeAdd();
        setActiveContact(newContact);
      }
    });
  }

  function handleContactUpdated(updated: Contact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    // Functional form, not `if (activeContact?.id === updated.id) setActiveContact(updated)` —
    // this callback can resolve after the drawer was already closed (e.g. user
    // blurs a field and immediately clicks away), and closing over the stale
    // `activeContact` from call time would reopen it with the save result.
    setActiveContact((prev) => (prev?.id === updated.id ? updated : prev));
  }

  function handleContactDeleted(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setActiveContact(null);
  }

  function handleStageCreated(stage: Stage) {
    setStages((prev) => [...prev, stage].sort((a, b) => a.position - b.position));
  }

  function handleStageUpdated(updated: Stage) {
    setStages((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleStageDeleted(id: string) {
    setStages((prev) => prev.filter((s) => s.id !== id));
    setContacts((prev) => prev.map((c) => c.stage_id === id ? { ...c, stage_id: null } : c));
  }

  function handleStagesReordered(reordered: Stage[]) {
    setStages(reordered);
  }

  function handleCompleteNextAction(contact: Contact) {
    if (!contact.next_action?.trim()) return;
    const date = format(new Date(), "MMM d, yyyy");
    const entry = `✓ ${date}: ${contact.next_action.trim()}`;
    const newNotes = contact.notes ? `${contact.notes}\n${entry}` : entry;
    const updated = { ...contact, next_action: null, notes: newNotes };
    handleContactUpdated(updated);
    startTransition(async () => {
      await updateContact(contact.id, { next_action: null, notes: newNotes });
    });
  }

  function handleTagCreated(tag: Tag) {
    setTags((prev) => [...prev, tag]);
  }

  function handleTagUpdated(updated: Tag) {
    setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleTagDeleted(id: string) {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setContacts((prev) => prev.map((c) => ({ ...c, tag_ids: c.tag_ids.filter((tid) => tid !== id) })));
    if (filterTagId === id) setFilterTagId("all");
  }

  function handleContactTagsChanged(contactId: string, tagIds: string[]) {
    setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, tag_ids: tagIds } : c));
    setActiveContact((prev) => (prev?.id === contactId ? { ...prev, tag_ids: tagIds } : prev));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {contacts.length} {contacts.length === 1 ? "contact" : "contacts"} tracked
          </p>
        </div>
        <button
          onClick={() => openAdd("__global__")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={15} />
          Add contact
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Stage filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStageId("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filterStageId === "all"
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            All stages
          </button>
          {stages.map((stage) => {
            const count = contacts.filter((c) => c.stage_id === stage.id).length;
            return (
              <button
                key={stage.id}
                onClick={() => setFilterStageId(filterStageId === stage.id ? "all" : stage.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                style={
                  filterStageId === stage.id
                    ? { backgroundColor: stage.color, borderColor: stage.color, color: "#fff" }
                    : { borderColor: stage.color, color: stage.color, backgroundColor: `${stage.color}15` }
                }
              >
                {stage.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Tag filters — only shown when tags exist */}
        {tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterTagId("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                filterTagId === "all"
                  ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              All tags
            </button>
            {tags.map((tag) => {
              const count = contacts.filter((c) => c.tag_ids.includes(tag.id)).length;
              return (
                <button
                  key={tag.id}
                  onClick={() => setFilterTagId(filterTagId === tag.id ? "all" : tag.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                  style={
                    filterTagId === tag.id
                      ? { backgroundColor: tag.color, borderColor: tag.color, color: "#fff" }
                      : { borderColor: tag.color, color: tag.color, backgroundColor: `${tag.color}15` }
                  }
                >
                  {tag.name} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add contact inline form */}
      {addingTarget === "__global__" && (
        <AddContactRow value={addingName} onChange={setAddingName} onSubmit={handleAdd} onCancel={closeAdd} pending={pending} />
      )}

      {/* Contact rows grouped by stage */}
      <div>
        {groups.length === 0 && (
          <div className="text-center py-12 text-[var(--muted-foreground)] text-sm">
            {filterStageId === "all" && filterTagId === "all"
              ? "No contacts yet — add your first one above."
              : "No contacts match the current filters."}
          </div>
        )}
        {groups.map((group, i) => {
          const isCollapsed = collapsedStages.has(group.key);
          const isAddingHere = addingTarget === group.key;
          return (
            <div key={group.key}>
              {/* Faint divider between stage groups */}
              {i > 0 && (
                <div className="my-4 border-t border-[var(--border)]/50" />
              )}

              {/* Stage section header */}
              <div className="flex items-center gap-1 mb-2 group/hdr">
                <button
                  onClick={() => toggleStage(group.key)}
                  className="flex items-center gap-2 flex-1 min-w-0 px-1 py-0.5 text-left"
                >
                  <ChevronDown
                    size={13}
                    className={`flex-shrink-0 text-[var(--muted-foreground)] transition-transform duration-150 ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                  <span
                    className="text-xs font-semibold tracking-wide"
                    style={{ color: group.stage?.color ?? "var(--muted-foreground)" }}
                  >
                    {group.stage?.name ?? "No stage"}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {group.contacts.length}
                  </span>
                </button>
                {group.stage && (
                  <button
                    onClick={() => openAdd(group.key)}
                    title={`Add to ${group.stage.name}`}
                    className="flex-shrink-0 p-1 rounded-md text-[var(--muted-foreground)] opacity-0 group-hover/hdr:opacity-100 hover:text-[var(--primary)] hover:bg-[var(--accent)] transition-opacity"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>

              {/* Contacts */}
              {!isCollapsed && (
                <div className="space-y-1">
                  {isAddingHere && (
                    <AddContactRow value={addingName} onChange={setAddingName} onSubmit={handleAdd} onCancel={closeAdd} pending={pending} />
                  )}
                  {group.contacts.length === 0 && !isAddingHere && (
                    <p className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]/60 italic">
                      No contacts in this stage yet
                    </p>
                  )}
                  {group.contacts.map((contact) => {
                    const stage = contact.stage_id ? stageMap[contact.stage_id] : null;
                    const contactTags = contact.tag_ids.map((id) => tagMap[id]).filter(Boolean) as Tag[];
                    const isActive = activeContact?.id === contact.id;

                    return (
                      <div
                        key={contact.id}
                        onClick={() => setActiveContact(isActive ? null : contact)}
                        className={`group w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all border cursor-pointer ${
                          isActive
                            ? "bg-[var(--accent)] border-[var(--primary)]/30"
                            : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]/20 hover:bg-[var(--accent)]/50"
                        }`}
                      >
                        {/* Stage color bar */}
                        <div
                          className="w-1 h-10 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage?.color ?? "#E2E8F0" }}
                        />

                        {/* Name + tags + next action */}
                        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-medium flex-none">{contact.name}</span>
                          {contactTags.map((tag) => (
                            <span
                              key={tag.id}
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-none"
                              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {contact.next_action && (
                            <span className="text-xs text-[var(--muted-foreground)] basis-full sm:basis-auto sm:flex-1 flex items-center gap-1 min-w-0">
                              <span className="text-[var(--primary)] font-medium flex-shrink-0">→</span>
                              <span className="truncate">{contact.next_action}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCompleteNextAction(contact); }}
                                title="Mark done"
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted-foreground)] hover:text-[var(--primary)] p-0.5 rounded"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                            </span>
                          )}
                        </div>

                        {/* Collaborators */}
                        {contact.collaborators && (
                          <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--muted-foreground)] flex-shrink-0">
                            <Users size={11} />
                            <span className="max-w-32 truncate">{contact.collaborators}</span>
                          </div>
                        )}

                        {/* Next session */}
                        {contact.next_session && (
                          <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--muted-foreground)] flex-shrink-0">
                            <Calendar size={11} />
                            <span>{format(parseISO(contact.next_session), "MMM d")}</span>
                          </div>
                        )}

                        {/* Stage badge — hidden when filtered to a single stage since it's obvious */}
                        {filterStageId === "all" && (
                          stage ? (
                            <span
                              className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                              style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                            >
                              {stage.name}
                            </span>
                          ) : (
                            <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium bg-[var(--muted)] text-[var(--muted-foreground)]">
                              No stage
                            </span>
                          )
                        )}

                        <ChevronRight size={14} className={`flex-shrink-0 text-[var(--muted-foreground)] transition-transform ${isActive ? "rotate-90" : ""}`} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ContactDrawer
        contact={activeContact}
        stages={stages}
        tags={tags}
        onClose={() => setActiveContact(null)}
        onContactDeleted={handleContactDeleted}
        onContactUpdated={handleContactUpdated}
        onStageCreated={handleStageCreated}
        onStageUpdated={handleStageUpdated}
        onStageDeleted={handleStageDeleted}
        onStagesReordered={handleStagesReordered}
        onTagCreated={handleTagCreated}
        onTagUpdated={handleTagUpdated}
        onTagDeleted={handleTagDeleted}
        onContactTagsChanged={handleContactTagsChanged}
      />
    </div>
  );
}
