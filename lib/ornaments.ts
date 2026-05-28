export interface OrnamentTokens {
  dividerChar: string;
  bulletChar: string;
  accentChar: string;
}

export interface OrnamentPreset {
  key: string;
  label: string;
  description: string;
  tokens: OrnamentTokens;
}

export const DEFAULT_ORNAMENT_KEY = "circle";

export const ORNAMENT_PRESETS: OrnamentPreset[] = [
  {
    key: "none",
    label: "None",
    description: "No decoration — clean negative space",
    tokens: { dividerChar: " ", bulletChar: "·", accentChar: "·" },
  },
  {
    key: "em_dash",
    label: "Editorial",
    description: "Typographic marks — em dashes and en dashes",
    tokens: { dividerChar: "—", bulletChar: "–", accentChar: "·" },
  },
  {
    key: "star",
    label: "Celestial",
    description: "Stars and cosmic symbols",
    tokens: { dividerChar: "✦", bulletChar: "★", accentChar: "·" },
  },
  {
    key: "circle",
    label: "Sacred Circle",
    description: "Rings and concentric circles",
    tokens: { dividerChar: "◎", bulletChar: "○", accentChar: "·" },
  },
  {
    key: "diamond",
    label: "Diamond",
    description: "Faceted, gem-like marks",
    tokens: { dividerChar: "◆", bulletChar: "◇", accentChar: "◦" },
  },
  {
    key: "floral",
    label: "Botanical",
    description: "Floral and leaf ornaments",
    tokens: { dividerChar: "✿", bulletChar: "❧", accentChar: "·" },
  },
  {
    key: "arrow",
    label: "Directional",
    description: "Arrows and motion marks",
    tokens: { dividerChar: "→", bulletChar: "›", accentChar: "·" },
  },
  {
    key: "cross",
    label: "Guild Mark",
    description: "Medieval cross and heraldic marks",
    tokens: { dividerChar: "✠", bulletChar: "†", accentChar: "·" },
  },
  {
    key: "music",
    label: "Music Notation",
    description: "Musical notes and symbols",
    tokens: { dividerChar: "♪", bulletChar: "♩", accentChar: "·" },
  },
  {
    key: "dot",
    label: "Minimal Dot",
    description: "Barely-there — a single quiet point",
    tokens: { dividerChar: "·", bulletChar: "·", accentChar: "·" },
  },
];

export const ORNAMENTS_BY_KEY: Record<string, OrnamentPreset> = Object.fromEntries(
  ORNAMENT_PRESETS.map((o) => [o.key, o])
);

export function buildOrnamentCssVars(tokens: OrnamentTokens): string {
  return [
    `--st-ornament-divider: "${tokens.dividerChar}";`,
    `--st-ornament-bullet: "${tokens.bulletChar}";`,
    `--st-ornament-accent: "${tokens.accentChar}";`,
  ].join(" ");
}
