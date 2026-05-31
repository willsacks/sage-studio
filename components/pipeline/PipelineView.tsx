"use client";

import { useState, useTransition } from "react";
import { Plus, Users, Calendar, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createContact } from "@/lib/actions/pipeline";
import { ContactDrawer } from "./ContactDrawer";
import type { Stage, Contact } from "@/app/(dashboard)/pipeline/page";

interface Props {
  stages: Stage[];
  contacts: Contact[];
}

export function PipelineView({ stages: initialStages, contacts: initialContacts }: Props) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [filterStageId, setFilterStageId] = useState<string | "all">("all");
  const [addingName, setAddingName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));

  const filteredContacts = filterStageId === "all"
    ? contacts
    : contacts.filter((c) => c.stage_id === filterStageId);

  function handleAdd() {
    if (!addingName.trim()) return;
    const defaultStageId = stages[0]?.id ?? null;
    startTransition(async () => {
      const res = await createContact(addingName.trim(), defaultStageId);
      if (res.contactId) {
        const newContact: Contact = {
          id: res.contactId,
          name: addingName.trim(),
          stage_id: defaultStageId,
          notes: null,
          collaborators: null,
          next_session: null,
          created_at: new Date().toISOString(),
        };
        setContacts((prev) => [newContact, ...prev]);
        setAddingName("");
        setShowAdd(false);
        setActiveContact(newContact);
      }
    });
  }

  function handleContactUpdated(updated: Contact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (activeContact?.id === updated.id) setActiveContact(updated);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {contacts.length} {contacts.length === 1 ? "contact" : "contacts"} tracked
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={15} />
          Add contact
        </button>
      </div>

      {/* Stage filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilterStageId("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            filterStageId === "all"
              ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
              : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          All ({contacts.length})
        </button>
        {stages.map((stage) => {
          const count = contacts.filter((c) => c.stage_id === stage.id).length;
          return (
            <button
              key={stage.id}
              onClick={() => setFilterStageId(stage.id)}
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

      {/* Add contact inline form */}
      {showAdd && (
        <div className="flex gap-2 items-center p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <input
            autoFocus
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setShowAdd(false); setAddingName(""); }
            }}
            placeholder="Artist or project name"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-foreground)]"
          />
          <button
            onClick={handleAdd}
            disabled={pending || !addingName.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setShowAdd(false); setAddingName(""); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Contact rows */}
      <div className="space-y-1">
        {filteredContacts.length === 0 && (
          <div className="text-center py-12 text-[var(--muted-foreground)] text-sm">
            {filterStageId === "all" ? "No contacts yet — add your first one above." : "No contacts in this stage."}
          </div>
        )}
        {filteredContacts.map((contact) => {
          const stage = contact.stage_id ? stageMap[contact.stage_id] : null;
          const isActive = activeContact?.id === contact.id;

          return (
            <button
              key={contact.id}
              onClick={() => setActiveContact(isActive ? null : contact)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all border ${
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

              {/* Name + notes */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{contact.name}</p>
                {contact.notes && (
                  <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">{contact.notes}</p>
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

              {/* Stage badge */}
              {stage ? (
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
              )}

              <ChevronRight size={14} className={`flex-shrink-0 text-[var(--muted-foreground)] transition-transform ${isActive ? "rotate-90" : ""}`} />
            </button>
          );
        })}
      </div>

      {/* Drawer */}
      <ContactDrawer
        contact={activeContact}
        stages={stages}
        onClose={() => setActiveContact(null)}
        onContactDeleted={handleContactDeleted}
        onContactUpdated={handleContactUpdated}
        onStageCreated={handleStageCreated}
        onStageUpdated={handleStageUpdated}
        onStageDeleted={handleStageDeleted}
        onStagesReordered={handleStagesReordered}
      />
    </div>
  );
}
