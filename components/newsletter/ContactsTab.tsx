"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listNewsletterContacts,
  addNewsletterContact,
  removeNewsletterContact,
  createNewsletterList,
} from "@/lib/actions/newsletter";
import type { NewsletterList } from "./NewsletterApp";

type Contact = { id: string; email: string; first_name: string | null; last_name: string | null };

export function ContactsTab({
  lists,
  loadingLists,
  onListsChanged,
}: {
  lists: NewsletterList[];
  loadingLists: boolean;
  onListsChanged: () => void;
}) {
  const [filterListId, setFilterListId] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newListIds, setNewListIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importListId, setImportListId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshContacts() {
    setLoadingContacts(true);
    setError(null);
    const result = await listNewsletterContacts(filterListId || undefined);
    if (result.error) setError(result.error);
    setContacts(result.contacts as Contact[]);
    setLoadingContacts(false);
  }

  useEffect(() => {
    refreshContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterListId]);

  async function handleAddContact() {
    if (!newEmail.trim() || newListIds.length === 0) return;
    setAdding(true);
    const result = await addNewsletterContact({
      email: newEmail,
      firstName: newFirstName || undefined,
      listIds: newListIds,
    });
    setAdding(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewEmail("");
    setNewFirstName("");
    setNewListIds([]);
    setShowAddForm(false);
    refreshContacts();
  }

  async function handleCreateList() {
    if (!newListName.trim()) return;
    setCreatingList(true);
    const result = await createNewsletterList(newListName);
    setCreatingList(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewListName("");
    onListsChanged();
  }

  async function handleImport(file: File) {
    if (!importListId) {
      setError("Choose a list to import into");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("listId", importListId);
      const res = await fetch("/api/newsletter/import-contacts", { method: "POST", body: formData });
      const result = await res.json() as { error?: string };
      if (!res.ok || result.error) {
        setError(result.error ?? "Import failed");
      } else {
        refreshContacts();
      }
    } catch {
      setError("Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove(contactId: string) {
    if (!filterListId) return; // removal is scoped to a specific list
    const result = await removeNewsletterContact(contactId, filterListId);
    if (result.error) setError(result.error);
    else refreshContacts();
  }

  return (
    <div className="space-y-4">
      {/* List filter + new list */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterListId}
          onChange={(e) => setFilterListId(e.target.value)}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        >
          <option value="">All lists</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 ml-auto">
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="New list name"
            className="h-8 text-sm w-40"
          />
          <Button size="sm" variant="outline" onClick={handleCreateList} disabled={creatingList || !newListName.trim()} className="h-8">
            {creatingList ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            <span className="ml-1">List</span>
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setShowAddForm((v) => !v)} className="h-8">
          <Plus size={13} className="mr-1" /> Add contact
        </Button>

        <select
          value={importListId}
          onChange={(e) => setImportListId(e.target.value)}
          className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        >
          <option value="">Import into…</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing || !importListId}
          className="h-8"
        >
          {importing ? <Loader2 size={13} className="animate-spin mr-1" /> : <Upload size={13} className="mr-1" />}
          Import CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
        />
      </div>

      {showAddForm && (
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2">
          <div className="flex gap-2">
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" type="email" className="h-8 text-sm" />
            <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Name (optional)" className="h-8 text-sm" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lists.map((l) => {
              const active = newListIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setNewListIds((ids) => active ? ids.filter((id) => id !== l.id) : [...ids, l.id])}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    active ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddContact} disabled={adding || !newEmail.trim() || newListIds.length === 0} className="h-8">
              {adding && <Loader2 size={13} className="animate-spin mr-1" />} Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)} className="h-8">Cancel</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Contacts table */}
      {loadingLists || loadingContacts ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">No contacts yet.</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{c.email}</p>
                {(c.first_name || c.last_name) && (
                  <p className="text-xs text-[var(--muted-foreground)]">{[c.first_name, c.last_name].filter(Boolean).join(" ")}</p>
                )}
              </div>
              {filterListId && (
                <button onClick={() => handleRemove(c.id)} className="text-[var(--muted-foreground)] hover:text-red-500">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
