"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, PenSquare, Send, Globe } from "lucide-react";
import { listNewsletterLists } from "@/lib/actions/newsletter";
import { ContactsTab } from "./ContactsTab";
import { ComposeTab } from "./ComposeTab";
import { SentTab } from "./SentTab";
import { DomainsTab } from "./DomainsTab";

type Tab = "contacts" | "compose" | "sent" | "domains";
export type NewsletterList = { id: string; name: string };

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "compose", label: "Compose", icon: PenSquare },
  { id: "sent", label: "Sent", icon: Send },
  { id: "domains", label: "Domains", icon: Globe },
];

export function NewsletterApp() {
  const [tab, setTab] = useState<Tab>("contacts");
  const [lists, setLists] = useState<NewsletterList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const refreshLists = useCallback(async () => {
    const result = await listNewsletterLists();
    setLists(result.lists ?? []);
    setLoadingLists(false);
  }, []);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[var(--primary)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "contacts" && (
        <ContactsTab lists={lists} loadingLists={loadingLists} onListsChanged={refreshLists} />
      )}
      {tab === "compose" && <ComposeTab lists={lists} />}
      {tab === "sent" && <SentTab />}
      {tab === "domains" && <DomainsTab />}
    </div>
  );
}
