"use client";

import type { TestimonialBlockData } from "@/lib/types/builder";

export function TestimonialBlock({
  data,
}: {
  data: TestimonialBlockData;
  isEditing?: boolean;
}) {
  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)", containerType: "inline-size" } as React.CSSProperties}
    >
      <div style={{ maxWidth: "var(--st-container-max-width, 1200px)", margin: "0 auto" }}>
        {data.heading && (
          <div className="text-center mb-12">
            <h2
              className="font-bold"
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
          </div>
        )}

        <style>{`
          @container (min-width: 540px) { .cc-t-grid { grid-template-columns: repeat(2, 1fr); } }
          @container (min-width: 860px) { .cc-t-grid-3 { grid-template-columns: repeat(3, 1fr); } }
        `}</style>
        <div
          className={`grid gap-6 ${
            data.testimonials.length === 1
              ? "max-w-2xl mx-auto"
              : `cc-t-grid${data.testimonials.length >= 3 ? " cc-t-grid-3" : ""}`
          }`}
        >
          {data.testimonials.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-4 p-6"
              style={{
                backgroundColor: "var(--st-color-surface, #1A1712)",
                border: "1px solid var(--st-color-border, rgba(201,168,76,0.12))",
                borderRadius: "var(--st-border-radius, 2px)",
              }}
            >
              <span
                className="font-serif leading-none select-none"
                style={{
                  fontSize: "3.5rem",
                  color: "var(--st-color-accent, #C9A84C)",
                  lineHeight: 1,
                  marginBottom: "-0.5rem",
                  fontStyle: "var(--st-font-display-style, normal)" as React.CSSProperties["fontStyle"],
                }}
                aria-hidden="true"
              >
                &ldquo;
              </span>

              <blockquote
                className="flex-1 text-base leading-relaxed offer-text-prose"
                style={{
                  color: "var(--st-color-text-muted, #C8BFB0)",
                  lineHeight: "var(--st-line-height-body, 1.7)",
                  fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
                }}
                dangerouslySetInnerHTML={{ __html: t.quote }}
              />

              <div
                className="flex items-center gap-3 pt-2"
                style={{ borderTop: "1px solid var(--st-color-border, rgba(138,128,112,0.2))" }}
              >
                {t.avatar ? (
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    style={{
                      border: "1px solid var(--st-color-accent, rgba(201,168,76,0.3))",
                      objectPosition: `${t.avatarFocusX ?? 50}% ${t.avatarFocusY ?? 50}%`,
                    }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--st-color-accent, #C9A84C) 15%, transparent)",
                      color: "var(--st-color-accent, #C9A84C)",
                    }}
                  >
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: "var(--st-color-text, #F5F0E8)" }}
                  >
                    {t.name}
                  </p>
                  {t.title && (
                    <p
                      className="text-xs"
                      style={{ color: "var(--st-color-text-muted, #8A8070)" }}
                    >
                      {t.title}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
