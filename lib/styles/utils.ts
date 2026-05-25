import type { StyleTokens } from "./types";

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
