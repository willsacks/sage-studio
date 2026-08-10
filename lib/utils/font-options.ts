// Curated font picker list for the HTML page editor's "Font" panel — pulled
// from the same Google Fonts already vetted and used across the built-in
// site themes (see lib/styles/themes.ts), so every option here is a font
// this app already knows how to load and render well, grouped by the same
// generic-fallback category so a page still looks reasonable if the actual
// Google Font briefly fails to load.
export type FontCategory = "Serif" | "Sans Serif" | "Display" | "Monospace";

export interface FontOption {
  family: string;
  category: FontCategory;
  fallback: "serif" | "sans-serif" | "monospace";
}

export const FONT_OPTIONS: FontOption[] = [
  // Serif
  { family: "Playfair Display", category: "Serif", fallback: "serif" },
  { family: "Cormorant Garamond", category: "Serif", fallback: "serif" },
  { family: "Libre Baskerville", category: "Serif", fallback: "serif" },
  { family: "Source Serif 4", category: "Serif", fallback: "serif" },
  { family: "Fraunces", category: "Serif", fallback: "serif" },
  { family: "Lora", category: "Serif", fallback: "serif" },
  { family: "EB Garamond", category: "Serif", fallback: "serif" },
  { family: "Crimson Pro", category: "Serif", fallback: "serif" },
  { family: "Merriweather", category: "Serif", fallback: "serif" },
  // Sans Serif
  { family: "Inter", category: "Sans Serif", fallback: "sans-serif" },
  { family: "Outfit", category: "Sans Serif", fallback: "sans-serif" },
  { family: "Jost", category: "Sans Serif", fallback: "sans-serif" },
  { family: "Raleway", category: "Sans Serif", fallback: "sans-serif" },
  { family: "Archivo", category: "Sans Serif", fallback: "sans-serif" },
  { family: "Josefin Sans", category: "Sans Serif", fallback: "sans-serif" },
  { family: "Work Sans", category: "Sans Serif", fallback: "sans-serif" },
  { family: "Nunito Sans", category: "Sans Serif", fallback: "sans-serif" },
  // Display
  { family: "Space Grotesk", category: "Display", fallback: "sans-serif" },
  { family: "Bebas Neue", category: "Display", fallback: "sans-serif" },
  { family: "Abril Fatface", category: "Display", fallback: "serif" },
  { family: "Archivo Black", category: "Display", fallback: "sans-serif" },
  { family: "DM Serif Display", category: "Display", fallback: "serif" },
  // Monospace
  { family: "DM Mono", category: "Monospace", fallback: "monospace" },
  { family: "Space Mono", category: "Monospace", fallback: "monospace" },
  { family: "Courier Prime", category: "Monospace", fallback: "monospace" },
  { family: "IBM Plex Mono", category: "Monospace", fallback: "monospace" },
];

export const FONT_CATEGORIES: FontCategory[] = ["Serif", "Sans Serif", "Display", "Monospace"];

export function findFontOption(family: string | null | undefined): FontOption | null {
  if (!family) return null;
  const normalized = family.trim().toLowerCase();
  return FONT_OPTIONS.find((f) => f.family.toLowerCase() === normalized) ?? null;
}

// Reduces a CSS font-family stack ("\"Playfair Display\", serif") down to
// just the first, actual font name, for matching against FONT_OPTIONS.
export function firstFontName(fontFamilyCss: string | null | undefined): string | null {
  if (!fontFamilyCss) return null;
  const first = fontFamilyCss.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first || null;
}
