"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { setSiteResendLists } from "@/lib/actions/sites";

type NewsletterList = { id: string; name: string };

type Props = {
  siteId: string;
  lists: NewsletterList[];
  currentListIds: string[];
};

/** Which of the site owner's account-level newsletter lists this site's
 * captured emails (Email Gate blocks, page gates) feed into. A site can
 * feed zero, one, or several lists — lists themselves are managed from
 * the top-level Newsletter page, not here. */
export function SiteNewsletterListsForm({ siteId, lists, currentListIds }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(currentListIds);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id];
    setSelected(next);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setSiteResendLists(siteId, next);
      if (result.error) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  if (lists.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No lists yet — create one from the{" "}
        <a href="/newsletter" className="text-[var(--primary)] hover:underline">Newsletter</a> page first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {lists.map((list) => {
          const active = selected.includes(list.id);
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => toggle(list.id)}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]"
              }`}
            >
              {active && <Check size={12} />}
              {list.name}
            </button>
          );
        })}
        {isPending && <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)] self-center" />}
      </div>
      {saved && <p className="text-xs text-green-600">Saved</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
