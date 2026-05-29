"use client";

import type { ImageBlockData } from "@/lib/types/builder";

const WIDTH_MAP: Record<ImageBlockData["width"], string> = {
  full: "100%",
  wide: "var(--st-container-max-width, 1200px)",
  medium: "760px",
  small: "480px",
};

const PADDING_MAP: Record<ImageBlockData["padding"], string> = {
  none: "0",
  sm: "1rem",
  md: "3rem",
  lg: "6rem",
};

const ALIGN_MAP: Record<ImageBlockData["alignment"], string> = {
  left: "0 auto 0 0",
  center: "0 auto",
  right: "0 0 0 auto",
};

export function ImageBlock({ data }: { data: ImageBlockData; isEditing?: boolean }) {
  const paddingY = PADDING_MAP[data.padding ?? "md"];
  const maxWidth = WIDTH_MAP[data.width ?? "wide"];
  const margin = data.width === "full" ? undefined : ALIGN_MAP[data.alignment ?? "center"];

  const imgStyle: React.CSSProperties = {
    width: "100%",
    display: "block",
    objectFit: "cover",
    objectPosition: `${data.imageFocusX ?? 50}% ${data.imageFocusY ?? 50}%`,
  };

  return (
    <section
      style={{
        backgroundColor: "var(--st-color-background, #0E0C09)",
        paddingTop: paddingY,
        paddingBottom: paddingY,
        paddingLeft: data.width === "full" ? undefined : "2rem",
        paddingRight: data.width === "full" ? undefined : "2rem",
      }}
    >
      <div style={{ maxWidth, margin }}>
        {data.image ? (
          <img src={data.image} alt={data.caption ?? ""} style={imgStyle} />
        ) : (
          <div
            style={{
              backgroundColor: "var(--st-color-surface, #1A1712)",
              border: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
              minHeight: "320px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"
              style={{ color: "var(--st-color-text-muted, #8A8070)" }} aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ fontSize: "0.875rem", color: "var(--st-color-text-muted, #8A8070)" }}>Image</span>
          </div>
        )}
        {data.caption && (
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              color: "var(--st-color-text-muted, #8A8070)",
              textAlign: data.alignment ?? "center",
              fontFamily: `var(--st-font-body, "Cormorant Garamond"), serif`,
              fontStyle: "italic",
            }}
          >
            {data.caption}
          </p>
        )}
      </div>
    </section>
  );
}
