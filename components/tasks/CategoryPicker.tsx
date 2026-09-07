"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Tag, ChevronDown, Plus, Building2, Check } from "lucide-react";
import type { CategorySelection } from "@/lib/actions/time-entries";
import { createClientRecord } from "@/lib/actions/clients";

export const PRESET_CATEGORIES = [
  "Creative Work",
  "Life Admin",
  "Housework",
  "Travel",
  "Learning",
  "Exercise",
  "Social",
  "Rest",
];

export interface ClientOption {
  id: string;
  name: string;
}

interface CategoryPickerProps {
  value: CategorySelection;
  onChange: (sel: CategorySelection) => void;
  clients?: ClientOption[];
  onClientCreated?: (client: ClientOption) => void;
}

export function CategoryPicker({ value, onChange, clients = [], onClientCreated }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (addingClient) inputRef.current?.focus();
  }, [addingClient]);

  const selectedClient = value.client_id ? clients.find((c) => c.id === value.client_id) : null;
  const hasValue = !!value.category || !!value.client_id;
  const label = selectedClient ? selectedClient.name : (value.category ?? "Add tag");

  function selectCategory(cat: string) {
    onChange({ category: cat, client_id: null });
    setOpen(false);
  }

  function selectClient(client: ClientOption) {
    onChange({ category: null, client_id: client.id });
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ category: null, client_id: null });
  }

  function handleCreateClient() {
    const name = newClientName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createClientRecord(name);
      if (result.client) {
        onClientCreated?.(result.client);
        onChange({ category: null, client_id: result.client.id });
        setNewClientName("");
        setAddingClient(false);
        setOpen(false);
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
          hasValue
            ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--foreground)]"
            : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
        }`}
      >
        {selectedClient ? <Building2 size={11} /> : <Tag size={11} />}
        <span className="max-w-[120px] truncate">{label}</span>
        {hasValue ? (
          <span
            onClick={clear}
            className="ml-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
            title="Clear"
          >
            ×
          </span>
        ) : (
          <ChevronDown size={11} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 max-w-[calc(100vw-2rem)] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Clients section */}
          <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide border-b border-[var(--border)] flex items-center justify-between">
            <span>Clients</span>
            <button
              type="button"
              onClick={() => setAddingClient((a) => !a)}
              className="p-1 -m-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title="New client"
            >
              <Plus size={13} />
            </button>
          </div>

          {addingClient && (
            <div className="px-2 py-1.5 border-b border-[var(--border)] flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateClient();
                  if (e.key === "Escape") { setAddingClient(false); setNewClientName(""); }
                }}
                placeholder="Client name…"
                className="flex-1 min-w-0 text-xs bg-transparent focus:outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                disabled={pending}
              />
              <button
                type="button"
                onClick={handleCreateClient}
                disabled={pending || !newClientName.trim()}
                className="text-[var(--primary)] hover:opacity-70 disabled:opacity-30 transition-opacity"
              >
                <Check size={11} />
              </button>
            </div>
          )}

          {clients.length === 0 && !addingClient && (
            <p className="px-3 py-2 text-xs text-[var(--muted-foreground)] italic">No clients yet</p>
          )}
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectClient(c)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5 ${
                value.client_id === c.id ? "text-[var(--primary)] font-medium" : "text-[var(--foreground)]"
              }`}
            >
              <Building2 size={10} className="flex-shrink-0 text-[var(--muted-foreground)]" />
              {c.name}
            </button>
          ))}

          {/* Categories section */}
          <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide border-t border-b border-[var(--border)] mt-0.5">
            Categories
          </div>
          {PRESET_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => selectCategory(cat)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--accent)] transition-colors ${
                value.category === cat ? "text-[var(--primary)] font-medium" : "text-[var(--foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
