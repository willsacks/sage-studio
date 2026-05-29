"use client";

import type { ImageTextBlockData } from "@/lib/types/builder";

function hasTextContent(body: string): boolean {
  return body.replace(/<[^>]*>/g, "").trim().length > 0;
}

export function ImageTextBlock({
  data,
  isEditing,
}: {
  data: ImageTextBlockData;
  isEditing?: boolean;
}) {
  const hasText = !!(data.heading || data.subheading || hasTextContent(data.body) || data.ctaText);
  const isCentered = data.imagePosition === "centered" || !hasText;

  const ImagePlaceholder = (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        style={{ color: "var(--st-color-text-muted, #8A8070)" }}
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <span className="text-sm" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
        Image
      </span>
    </div>
  );

  if (isCentered) {
    return (
      <section
        className="w-full px-8 py-16"
        style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
      >
        <div
          className="mx-auto flex flex-col items-center gap-8 text-center"
          style={{ maxWidth: "680px" }}
        >
          <div
            className="w-full overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: "var(--st-color-surface, #1A1712)",
              border: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
              borderRadius: "var(--st-border-radius, 2px)",
              minHeight: "320px",
            }}
          >
            {data.image ? (
              <img
                src={data.image}
                alt={data.heading ?? ""}
                className="w-full h-full object-cover"
                style={{
                  minHeight: "320px",
                  objectPosition: `${data.imageFocusX ?? 50}% ${data.imageFocusY ?? 50}%`,
                }}
              />
            ) : ImagePlaceholder}
          </div>

          {hasText && (
            <div className="flex flex-col items-center gap-5 w-full">
              {data.heading && (
                <h2
                  className="leading-tight"
                  style={{
                    fontSize: "clamp(1.5rem, 3vw, 2rem)",
                    color: "var(--st-color-text, #F5F0E8)",
                    fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
                    fontWeight: "var(--st-font-display-weight, 700)",
                    fontStyle: "var(--st-font-display-style, normal)" as React.CSSProperties["fontStyle"],
                    letterSpacing: "var(--st-letter-spacing-display, -0.02em)",
                  }}
                >
                  {data.heading}
                </h2>
              )}

              {data.subheading && (
                <p
                  style={{
                    fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
                    color: "var(--st-color-text-muted, #C8BFB0)",
                    lineHeight: "var(--st-line-height-body, 1.6)",
                    fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
                    marginTop: data.heading ? "-0.5rem" : undefined,
                  }}
                >
                  {data.subheading}
                </p>
              )}

              {hasTextContent(data.body) && (
                <div
                  className="leading-relaxed offer-text-prose"
                  style={{
                    fontSize: "1rem",
                    color: "var(--st-color-text-muted, #C8BFB0)",
                    lineHeight: "var(--st-line-height-body, 1.7)",
                    fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
                  }}
                  dangerouslySetInnerHTML={{ __html: data.body }}
                />
              )}

              {data.ctaText && (
                <a
                  href={data.ctaLink ?? "#"}
                  className="inline-block px-6 py-2.5 font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
                  style={{
                    backgroundColor: "var(--st-color-accent, #C9A84C)",
                    color: "var(--st-color-text-inverse, #0E0C09)",
                    borderRadius: "var(--st-border-radius-button, 2px)",
                    textTransform: "var(--st-button-text-transform, uppercase)" as React.CSSProperties["textTransform"],
                    letterSpacing: "var(--st-button-letter-spacing, 0.05em)",
                  }}
                  onClick={isEditing ? (e) => e.preventDefault() : undefined}
                >
                  {data.ctaText}
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  const imageFirst = data.imagePosition !== "right";

  const ImagePanel = (
    <div
      className="flex-1 overflow-hidden flex items-center justify-center"
      style={{
        backgroundColor: "var(--st-color-surface, #1A1712)",
        border: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
        borderRadius: "var(--st-border-radius, 2px)",
        minHeight: "320px",
      }}
    >
      {data.image ? (
        <img
          src={data.image}
          alt={data.heading ?? ""}
          className="w-full h-full object-cover"
          style={{
            minHeight: "320px",
            objectPosition: `${data.imageFocusX ?? 50}% ${data.imageFocusY ?? 50}%`,
          }}
        />
      ) : ImagePlaceholder}
    </div>
  );

  const TextPanel = (
    <div className="flex-1 flex flex-col justify-center gap-5 py-4">
      {data.heading && (
        <h2
          className="leading-tight"
          style={{
            fontSize: "clamp(1.5rem, 3vw, 2rem)",
            color: "var(--st-color-text, #F5F0E8)",
            fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
            fontWeight: "var(--st-font-display-weight, 700)",
            fontStyle: "var(--st-font-display-style, normal)" as React.CSSProperties["fontStyle"],
            letterSpacing: "var(--st-letter-spacing-display, -0.02em)",
          }}
        >
          {data.heading}
        </h2>
      )}

      {data.subheading && (
        <p
          style={{
            fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
            color: "var(--st-color-text-muted, #C8BFB0)",
            lineHeight: "var(--st-line-height-body, 1.6)",
            fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
            marginTop: data.heading ? "-0.5rem" : undefined,
          }}
        >
          {data.subheading}
        </p>
      )}

      <div
        className="leading-relaxed offer-text-prose"
        style={{
          fontSize: "1rem",
          color: "var(--st-color-text-muted, #C8BFB0)",
          lineHeight: "var(--st-line-height-body, 1.7)",
          fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
        }}
        dangerouslySetInnerHTML={{ __html: data.body }}
      />

      {data.ctaText && (
        <div>
          <a
            href={data.ctaLink ?? "#"}
            className="inline-block px-6 py-2.5 font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              backgroundColor: "var(--st-color-accent, #C9A84C)",
              color: "var(--st-color-text-inverse, #0E0C09)",
              borderRadius: "var(--st-border-radius-button, 2px)",
              textTransform: "var(--st-button-text-transform, uppercase)" as React.CSSProperties["textTransform"],
              letterSpacing: "var(--st-button-letter-spacing, 0.05em)",
            }}
            onClick={isEditing ? (e) => e.preventDefault() : undefined}
          >
            {data.ctaText}
          </a>
        </div>
      )}
    </div>
  );

  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div style={{ maxWidth: "var(--st-container-max-width, 1200px)", margin: "0 auto" }}>
        <div className="flex flex-col sm:flex-row gap-10 sm:gap-14 items-center">
          {imageFirst ? (
            <>
              {ImagePanel}
              {TextPanel}
            </>
          ) : (
            <>
              {TextPanel}
              {ImagePanel}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
