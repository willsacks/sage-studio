"use client";

import type { SpacerBlockData } from "@/lib/types/builder";

const heights = {
  sm: "32px",
  md: "64px",
  lg: "96px",
  xl: "128px",
} as const;

export function SpacerBlock({
  data,
  isEditing,
}: {
  data: SpacerBlockData;
  isEditing?: boolean;
}) {
  const height = heights[data.height ?? "md"];

  if (isEditing) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{
          height,
          border: "1px dashed color-mix(in srgb, var(--st-color-text-muted, #8A8070) 35%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--st-color-surface, #1A1712) 40%, transparent)",
        }}
        aria-label={`Spacer (${data.height})`}
      >
        <span
          className="text-xs tracking-widest uppercase select-none"
          style={{ color: "var(--st-color-text-muted, #8A8070)" }}
        >
          Spacer — {data.height}
        </span>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      style={{
        height,
        backgroundColor: "var(--st-color-background, #0E0C09)",
      }}
      aria-hidden="true"
    />
  );
}
