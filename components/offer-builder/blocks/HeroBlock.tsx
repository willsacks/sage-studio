"use client";

import type { HeroBlockData } from "@/lib/types/builder";

const heights = {
  sm: "300px",
  md: "450px",
  lg: "600px",
  full: "100vh",
} as const;

export function HeroBlock({
  data,
  isEditing,
}: {
  data: HeroBlockData;
  isEditing?: boolean;
}) {
  const height =
    data.height === "full" && isEditing
      ? "400px"
      : heights[data.height ?? "lg"];

  const bgType = data.backgroundType ?? "image";
  const focusX = data.backgroundFocusX ?? 50;
  const focusY = data.backgroundFocusY ?? 50;
  const hasCta = !!data.ctaText;
  const hasParagraph = !!data.paragraph;
  const center = (data.textAlign ?? "center") === "center";

  return (
    <section
      className="relative flex items-center overflow-hidden w-full"
      style={{
        minHeight: height,
        ...(bgType === "image" && data.backgroundImage
          ? {
              backgroundImage: `url(${data.backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: `${focusX}% ${focusY}%`,
            }
          : {}),
        backgroundColor: "var(--st-color-background, #0E0C09)",
      }}
    >
      {/* Video background */}
      {bgType === "video" && data.backgroundVideo && (
        <video
          src={data.backgroundVideo}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `${focusX}% ${focusY}%` }}
          autoPlay
          muted
          loop
          playsInline
        />
      )}

      {/* Overlay */}
      {data.overlay && (data.backgroundImage || data.backgroundVideo) && (
        <div
          className="absolute inset-0"
          style={{ background: "var(--st-hero-overlay, rgba(0,0,0,0.6))" }}
        />
      )}

      <div
        className="relative z-10 w-full mx-auto px-8 py-16"
        style={{
          maxWidth: "var(--st-container-max-width, 1100px)",
          textAlign: data.textAlign ?? "center",
        }}
      >
        <h1
          className="leading-tight mb-4"
          style={{
            fontSize: "clamp(2rem, 5vw, 4rem)",
            color: "var(--st-color-text, #F5F0E8)",
            fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
            fontWeight: "var(--st-font-display-weight, 700)",
            fontStyle: "var(--st-font-display-style, normal)" as React.CSSProperties["fontStyle"],
            letterSpacing: "var(--st-letter-spacing-display, -0.02em)",
          }}
        >
          {data.headline}
        </h1>

        {data.subheadline && (
          <p
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              color: "var(--st-color-text-muted, #C8BFB0)",
              lineHeight: "var(--st-line-height-body, 1.6)",
              maxWidth: center ? "36rem" : undefined,
              margin: center
                ? `0 auto ${hasParagraph || hasCta ? "2rem" : "0"}`
                : `0 0 ${hasParagraph || hasCta ? "2rem" : "0"}`,
            }}
          >
            {data.subheadline}
          </p>
        )}

        {data.paragraph && (
          <>
            <div
              style={{
                width: 40,
                height: 1,
                backgroundColor: "var(--st-color-accent, #C9A84C)",
                opacity: 0.55,
                margin: center ? "0 auto 1.75rem" : "0 0 1.75rem",
              }}
            />
            <p
              className="offer-text-prose"
              style={{
                fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)",
                color: "var(--st-color-text-muted, #8A8070)",
                lineHeight: 1.85,
                fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
                letterSpacing: "0.015em",
                maxWidth: center ? "34rem" : "42rem",
                margin: center
                  ? `0 auto ${hasCta ? "2.5rem" : "0"}`
                  : `0 0 ${hasCta ? "2.5rem" : "0"}`,
              }}
              dangerouslySetInnerHTML={{ __html: data.paragraph }}
            />
          </>
        )}

        {data.ctaText && (
          <a
            href={data.ctaLink ?? "#"}
            className="inline-block px-8 py-3 font-semibold text-base transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              backgroundColor: "var(--st-color-accent, #C9A84C)",
              color: "var(--st-color-text-inverse, #0E0C09)",
              borderRadius: "var(--st-border-radius-button, 2px)",
              fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
              textTransform: "var(--st-button-text-transform, uppercase)" as React.CSSProperties["textTransform"],
              letterSpacing: "var(--st-button-letter-spacing, 0.05em)",
              border: "var(--st-button-border-width, 0) solid var(--st-color-accent, #C9A84C)",
            }}
            onClick={isEditing ? (e) => e.preventDefault() : undefined}
          >
            {data.ctaText}
          </a>
        )}
      </div>
    </section>
  );
}
