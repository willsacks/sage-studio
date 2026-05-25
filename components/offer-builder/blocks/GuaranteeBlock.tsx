"use client";

import type { GuaranteeBlockData } from "@/lib/types/builder";

export function GuaranteeBlock({
  data,
}: {
  data: GuaranteeBlockData;
  isEditing?: boolean;
}) {
  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div className="max-w-2xl mx-auto">
        <div
          className="px-8 py-10 text-center"
          style={{
            backgroundColor: "var(--st-color-surface, #1A1712)",
            border: "2px solid var(--st-color-accent, #C9A84C)",
            borderRadius: "var(--st-border-radius, 2px)",
            boxShadow: "0 0 48px color-mix(in srgb, var(--st-color-accent, #C9A84C) 8%, transparent), inset 0 0 48px color-mix(in srgb, var(--st-color-accent, #C9A84C) 3%, transparent)",
          }}
        >
          {data.icon && (
            <div className="text-5xl mb-5 leading-none" aria-hidden="true">
              {data.icon}
            </div>
          )}

          <h2
            className="font-bold mb-4"
            style={{
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              color: "var(--st-color-text, #F5F0E8)",
              fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
              fontWeight: "var(--st-font-display-weight, 700)",
              fontStyle: "var(--st-font-display-style, normal)" as React.CSSProperties["fontStyle"],
            }}
          >
            {data.heading}
          </h2>

          <div
            className="leading-relaxed offer-text-prose"
            style={{
              fontSize: "1rem",
              color: "var(--st-color-text-muted, #C8BFB0)",
              lineHeight: "var(--st-line-height-body, 1.7)",
            }}
            dangerouslySetInnerHTML={{ __html: data.body }}
          />

          <div
            className="mt-8 mx-auto"
            style={{
              width: "48px",
              height: "2px",
              background: "linear-gradient(90deg, transparent, var(--st-color-accent, #C9A84C), transparent)",
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}
