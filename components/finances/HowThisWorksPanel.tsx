"use client";

import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import { HELP_CONTENT, type HelpKey } from "@/lib/finance/help-content";

/** Docked contextual help — content updates based on whichever tab or
 * dialog the user currently has open (see FinancesApp.tsx's `helpKey`
 * state), similar to Ableton Live's Info View. Deliberately not a modal:
 * it sits in-layout beside the content on desktop rather than covering it,
 * so it can stay open while you work. On mobile there's no spare width for
 * a docked column, so FinancesApp renders this inside a slide-over instead
 * — this component itself doesn't know or care which container it's in. */
export function HowThisWorksPanel({ helpKey, onClose }: { helpKey: HelpKey; onClose: () => void }) {
  const entry = HELP_CONTENT[helpKey];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <p className="text-sm font-semibold">How This Works</p>
        <button onClick={onClose} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <p className="text-sm font-medium">{entry.title}</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1.5 leading-relaxed">{entry.summary}</p>
        </div>

        {entry.tips.length > 0 && (
          <ul className="space-y-1.5">
            {entry.tips.map((tip, i) => (
              <li key={i} className="text-xs text-[var(--muted-foreground)] leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0">
                {tip}
              </li>
            ))}
          </ul>
        )}

        {entry.videoUrl && (
          <a
            href={entry.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
          >
            Watch the video walkthrough <ExternalLink size={12} />
          </a>
        )}

        <div className="pt-3 border-t border-[var(--border)] space-y-1.5">
          {entry.guideLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target="_blank"
              className="flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
            >
              {link.label} <ExternalLink size={12} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
