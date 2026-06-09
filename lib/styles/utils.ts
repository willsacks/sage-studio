import type { StyleTokens } from "./types";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY } from "./themes";

export function buildStyleCssVars(tokens: StyleTokens): string {
  return Object.entries(tokens)
    .map(([key, value]) => {
      const cssVar = "--st-" + key.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `${cssVar}: ${value};`;
    })
    .join(" ");
}

export function buildGoogleFontsUrl(families: string[]): string {
  const unique = [...new Set(families.filter(Boolean))];
  const params = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,300;0,400;0,600;0,700;0,900;1,400;1,600;1,700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export function getFontsForTokens(tokens: StyleTokens): string[] {
  return [tokens.fontDisplay, tokens.fontBody, tokens.fontMono].filter(Boolean);
}

export function resolveStyleTokens(site: {
  style_key?: string | null;
  custom_style?: unknown;
}): StyleTokens {
  const styleKey = site.style_key ?? DEFAULT_STYLE_KEY;
  const baseTokens = (THEMES_BY_KEY[styleKey === "custom" ? DEFAULT_STYLE_KEY : styleKey] ?? THEMES_BY_KEY[DEFAULT_STYLE_KEY]).tokens;
  if (styleKey === "custom" && site.custom_style && typeof site.custom_style === "object") {
    return { ...baseTokens, ...(site.custom_style as Partial<StyleTokens>) };
  }
  return baseTokens;
}
