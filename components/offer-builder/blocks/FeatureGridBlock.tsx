"use client";

import type { FeatureGridBlockData } from "@/lib/types/builder";

const colClasses = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function FeatureGridBlock({
  data,
}: {
  data: FeatureGridBlockData;
  isEditing?: boolean;
}) {
  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background-alt, #0E0C09)" }}
    >
      <div style={{ maxWidth: "var(--st-container-max-width, 1200px)", margin: "0 auto" }}>
        {(data.heading || data.subheading) && (
          <div className="text-center mb-12">
            {data.heading && (
              <h2
                className="font-bold mb-3"
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  color: "var(--st-color-text, #F5F0E8)",
                  fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
                  fontWeight: "var(--st-font-display-weight, 700)",
                  letterSpacing: "var(--st-letter-spacing-display, -0.02em)",
                }}
              >
                {data.heading}
              </h2>
            )}
            {data.subheading && (
              <p
                className="max-w-xl mx-auto"
                style={{
                  color: "var(--st-color-text-muted, #C8BFB0)",
                  fontSize: "1rem",
                  lineHeight: "var(--st-line-height-body, 1.6)",
                }}
              >
                {data.subheading}
              </p>
            )}
          </div>
        )}

        <div className={`grid gap-6 ${colClasses[data.columns ?? 3]}`}>
          {data.features.map((feature) => (
            <div
              key={feature.id}
              className="flex flex-col gap-3 p-6"
              style={{
                backgroundColor: "var(--st-color-surface, #1A1712)",
                border: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
                borderRadius: "var(--st-border-radius, 2px)",
                boxShadow: "var(--st-card-style, none)",
              }}
            >
              {feature.icon && (
                <span
                  className="text-3xl leading-none"
                  style={{ color: "var(--st-color-accent, #C9A84C)" }}
                  aria-hidden="true"
                >
                  {feature.icon}
                </span>
              )}

              <h3
                className="font-semibold text-base"
                style={{
                  color: "var(--st-color-text, #F5F0E8)",
                  fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
                }}
              >
                {feature.title}
              </h3>

              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--st-color-text-muted, #C8BFB0)" }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
