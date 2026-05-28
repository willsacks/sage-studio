"use client";

import type { DividerBlockData } from "@/lib/types/builder";

export function DividerBlock({
  data,
}: {
  data: DividerBlockData;
  isEditing?: boolean;
}) {
  const widthClass =
    data.width === "centered" ? "w-1/2 mx-auto" : "w-full";

  if (data.style === "ornament") {
    return (
      <div
        className="w-full px-8 py-6 flex items-center justify-center"
        style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
      >
        <div
          className={`st-ornament-divider ${data.width === "centered" ? "w-1/2" : "w-full"}`}
          style={{
            color: "var(--st-color-accent, #C9A84C)",
            opacity: 0.6,
            fontSize: "1.1em",
            letterSpacing: "0.5em",
          }}
          role="separator"
        />
      </div>
    );
  }

  let ruleStyle: React.CSSProperties;

  switch (data.style) {
    case "dotted":
      ruleStyle = {
        border: "none",
        borderTop: "2px dotted color-mix(in srgb, var(--st-color-accent, #C9A84C) 40%, transparent)",
        height: 0,
      };
      break;
    case "gradient":
      ruleStyle = {
        border: "none",
        height: "1px",
        background:
          "linear-gradient(90deg, transparent 0%, var(--st-color-accent, #C9A84C) 50%, transparent 100%)",
      };
      break;
    case "line":
    default:
      ruleStyle = {
        border: "none",
        borderTop: "1px solid color-mix(in srgb, var(--st-color-accent, #C9A84C) 30%, transparent)",
        height: 0,
      };
      break;
  }

  return (
    <div
      className="w-full px-8 py-6"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div className={widthClass} style={ruleStyle} role="separator" />
    </div>
  );
}
