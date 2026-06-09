import type { StyleTokens } from "@/lib/styles/types";

export function extractStyleFromHtml(html: string): Partial<StyleTokens> {
  const result: Partial<StyleTokens> = {};

  // Collect all CSS text from <style> blocks
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const allCss = styleBlocks.join("\n");

  // Parse CSS variables from :root {}
  const rootVars: Record<string, string> = {};
  const rootMatch = allCss.match(/:root\s*\{([^}]+)\}/);
  if (rootMatch) {
    for (const m of rootMatch[1].matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
      rootVars[m[1]] = m[2].trim();
    }
  }

  // Helper: pick first defined value from a list of candidate var names
  function pick(...keys: string[]): string | undefined {
    for (const k of keys) {
      if (rootVars[k]) return rootVars[k];
    }
  }

  // Colors
  const bg = pick("background", "bg", "color-bg", "background-color", "page-bg");
  if (bg) result.colorBackground = bg;

  const bgAlt = pick("background-alt", "bg-alt", "muted", "surface-alt");
  if (bgAlt) result.colorBackgroundAlt = bgAlt;

  const surface = pick("card", "surface", "color-surface", "panel");
  if (surface) result.colorSurface = surface;

  const text = pick("foreground", "text", "color-text", "text-color", "text-primary");
  if (text) result.colorText = text;

  const textMuted = pick("muted-foreground", "text-muted", "text-secondary", "color-muted");
  if (textMuted) result.colorTextMuted = textMuted;

  const accent = pick("primary", "accent", "color-primary", "color-accent", "brand", "highlight");
  if (accent) {
    result.colorAccent = accent;
    result.colorAccentHover = accent;
  }

  const border = pick("border", "color-border", "border-color", "divider");
  if (border) result.colorBorder = border;

  // Fonts
  const fontDisplay = pick("font-heading", "font-display", "heading-font", "font-serif", "display-font");
  if (fontDisplay) result.fontDisplay = fontDisplay.replace(/['"]/g, "").trim();

  const fontBody = pick("font-body", "font-sans", "body-font", "font-text", "text-font");
  if (fontBody) result.fontBody = fontBody.replace(/['"]/g, "").trim();

  const fontMono = pick("font-mono", "mono-font", "font-code");
  if (fontMono) result.fontMono = fontMono.replace(/['"]/g, "").trim();

  // Border radius
  const radius = pick("radius", "border-radius", "rounded", "corner-radius");
  if (radius) {
    result.borderRadius = radius;
    result.borderRadiusButton = radius;
    result.borderRadiusInput = radius;
  }

  // Fallback: scan body {} for background/color if no :root vars found
  if (!result.colorBackground || !result.colorText) {
    const bodyMatch = allCss.match(/body\s*\{([^}]+)\}/);
    if (bodyMatch) {
      if (!result.colorBackground) {
        const m = bodyMatch[1].match(/background(?:-color)?\s*:\s*([^;]+)/);
        if (m) result.colorBackground = m[1].trim();
      }
      if (!result.colorText) {
        const m = bodyMatch[1].match(/(?<![a-z-])color\s*:\s*([^;]+)/);
        if (m) result.colorText = m[1].trim();
      }
    }
  }

  return result;
}
