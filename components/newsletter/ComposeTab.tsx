"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { listNewsletterDomains, sendNewsletterBroadcast } from "@/lib/actions/newsletter";
import type { NewsletterList } from "./NewsletterApp";

type Domain = { id: string; name: string };

export function ComposeTab({ lists }: { lists: NewsletterList[] }) {
  const [listId, setListId] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [fromLocalPart, setFromLocalPart] = useState("");
  const [fromDomain, setFromDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    listNewsletterDomains().then((result) => {
      setDomains(result.domains as Domain[]);
      if (result.domains?.[0]) setFromDomain(result.domains[0].name);
      setLoadingDomains(false);
    });
  }, []);

  useEffect(() => {
    if (lists[0] && !listId) setListId(lists[0].id);
  }, [lists, listId]);

  async function handleSend() {
    setError(null);
    setSent(false);
    if (!listId) { setError("Choose a list"); return; }
    if (!fromLocalPart.trim() || !fromDomain) { setError("Choose a From address"); return; }
    setSending(true);
    const result = await sendNewsletterBroadcast({
      listId,
      subject,
      html,
      fromEmail: `${fromLocalPart.trim()}@${fromDomain}`,
      fromName: fromName.trim() || "Newsletter",
    });
    setSending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      setSubject("");
      setHtml("");
      setTimeout(() => setSent(false), 4000);
    }
  }

  if (!loadingDomains && domains.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        You need a verified sending domain before you can send. Add and verify one in the Domains tab, then come back here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Send to</label>
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="w-full h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
          >
            <option value="" disabled>Choose a list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">From</label>
          <div className="flex items-center gap-1">
            <Input value={fromLocalPart} onChange={(e) => setFromLocalPart(e.target.value)} placeholder="news" className="h-9 text-sm" />
            <span className="text-sm text-[var(--muted-foreground)]">@</span>
            <select
              value={fromDomain}
              onChange={(e) => setFromDomain(e.target.value)}
              className="h-9 px-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm flex-1"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">From name</label>
        <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your name" className="h-9 text-sm max-w-xs" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Subject</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's the update?" className="h-9 text-sm" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">Update</label>
        <RichTextEditor content={html} onChange={setHtml} placeholder="What have you been working on?" />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {sent && (
        <p className="text-sm text-green-600 flex items-center gap-1.5"><CheckCircle2 size={14} /> Sent!</p>
      )}

      <Button onClick={handleSend} disabled={sending || !subject.trim() || !html.trim()}>
        {sending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Send size={14} className="mr-1.5" />}
        Send Now
      </Button>
    </div>
  );
}
