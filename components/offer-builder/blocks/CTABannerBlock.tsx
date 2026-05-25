"use client";

import type { CTABannerBlockData } from "@/lib/types/builder";

type BgVariant = NonNullable<CTABannerBlockData["background"]>;

export function CTABannerBlock({
  data,
  isEditing,
}: {
  data: CTABannerBlockData;
  isEditing?: boolean;
}) {
  const variant: BgVariant = data.background ?? "dark";

  // Map the three variants to CSS-variable-aware styles
  const sectionStyle: React.CSSProperties = variant === "gold"
    ? {
        backgroundColor: "var(--st-color-accent, #C9A84C)",
      }
    : variant === "dark"
    ? {
        backgroundColor: "var(--st-color-surface, #1A1712)",
      }
    : {
        // brand
        backgroundColor: "var(--st-color-background, #0E0C09)",
        borderTop: "1px solid var(--st-color-accent, rgba(201,168,76,0.4))",
        borderBottom: "1px solid var(--st-color-accent, rgba(201,168,76,0.4))",
      };

  const headingColor = variant === "gold"
    ? "var(--st-color-background, #0E0C09)"
    : "var(--st-color-text, #F5F0E8)";

  const subColor = variant === "gold"
    ? "var(--st-color-surface, #1A1712)"
    : "var(--st-color-text-muted, #C8BFB0)";

  const btnStyle: React.CSSProperties = variant === "gold"
    ? {
        backgroundColor: "var(--st-color-background, #0E0C09)",
        color: "var(--st-color-accent, #C9A84C)",
      }
    : {
        backgroundColor: "var(--st-color-accent, #C9A84C)",
        color: "var(--st-color-text-inverse, #0E0C09)",
      };

  return (
    <section
      className="w-full px-8 py-16 text-center"
      style={sectionStyle}
    >
      <div
        className="mx-auto flex flex-col items-center gap-6"
        style={{ maxWidth: "48rem" }}
      >
        <h2
          className="font-bold leading-tight"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            color: headingColor,
            fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
            fontWeight: "var(--st-font-display-weight, 700)",
            fontStyle: "var(--st-font-display-style, normal)" as React.CSSProperties["fontStyle"],
            letterSpacing: "var(--st-letter-spacing-display, -0.02em)",
          }}
        >
          {data.heading}
        </h2>

        {data.subheading && (
          <p
            className="max-w-xl text-base leading-relaxed"
            style={{ color: subColor }}
          >
            {data.subheading}
          </p>
        )}

        <a
          href={data.ctaLink ?? "#"}
          className="inline-block px-8 py-3.5 font-bold text-base transition-opacity hover:opacity-90 active:opacity-80"
          style={{
            ...btnStyle,
            borderRadius: "var(--st-border-radius-button, 2px)",
            fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
            textTransform: "var(--st-button-text-transform, uppercase)" as React.CSSProperties["textTransform"],
            letterSpacing: "var(--st-button-letter-spacing, 0.05em)",
          }}
          onClick={isEditing ? (e) => e.preventDefault() : undefined}
        >
          {data.ctaText}
        </a>
      </div>
    </section>
  );
}
