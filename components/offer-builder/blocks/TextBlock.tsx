"use client";

import type { TextBlockData } from "@/lib/types/builder";

const fontSizes = {
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
} as const;

export function TextBlock({
  data,
}: {
  data: TextBlockData;
  isEditing?: boolean;
}) {
  return (
    <section
      className="w-full px-8 py-12"
      style={{
        backgroundColor: "var(--st-color-background, #0E0C09)",
        textAlign: data.alignment ?? "left",
      }}
    >
      <style>{`
        .offer-text-prose h1,
        .offer-text-prose h2,
        .offer-text-prose h3,
        .offer-text-prose h4 {
          color: var(--st-color-text, #F5F0E8);
          font-family: var(--st-font-display, "Playfair Display"), serif;
          font-weight: var(--st-font-display-weight, 700);
          line-height: 1.3;
          margin-bottom: 0.75em;
          margin-top: 1.5em;
        }
        .offer-text-prose h1 { font-size: 2em; }
        .offer-text-prose h2 { font-size: 1.5em; }
        .offer-text-prose h3 { font-size: 1.25em; }
        .offer-text-prose h4 { font-size: 1.1em; }
        .offer-text-prose p {
          color: var(--st-color-text-muted, #C8BFB0);
          margin-bottom: 1em;
        }
        .offer-text-prose ul,
        .offer-text-prose ol {
          color: var(--st-color-text-muted, #C8BFB0);
          padding-left: 1.5em;
          margin-bottom: 1em;
        }
        .offer-text-prose li {
          margin-bottom: 0.4em;
        }
        .offer-text-prose strong {
          color: var(--st-color-accent-hover, #E8C97A);
          font-weight: 600;
        }
        .offer-text-prose em {
          color: var(--st-color-text-muted, #C8BFB0);
          font-style: italic;
        }
        .offer-text-prose a {
          color: var(--st-color-accent, #C9A84C);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .offer-text-prose a:hover {
          color: var(--st-color-accent-hover, #E8C97A);
        }
        .offer-text-prose blockquote {
          border-left: 3px solid var(--st-color-accent, #C9A84C);
          padding-left: 1em;
          margin-left: 0;
          color: var(--st-color-text-muted, #8A8070);
          font-style: italic;
        }
      `}</style>

      <div
        className={`offer-text-prose${data.maxWidth ? " max-w-3xl mx-auto" : " w-full"}`}
        style={{
          fontSize: fontSizes[data.size ?? "base"],
          color: "var(--st-color-text-muted, #C8BFB0)",
          lineHeight: "var(--st-line-height-body, 1.7)",
          fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
        }}
        dangerouslySetInnerHTML={{ __html: data.content }}
      />
    </section>
  );
}
