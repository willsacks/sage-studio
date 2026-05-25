export interface StyleTokens {
  // Color palette
  colorBackground: string;
  colorBackgroundAlt: string;
  colorSurface: string;
  colorBorder: string;
  colorAccent: string;
  colorAccentHover: string;
  colorText: string;
  colorTextMuted: string;
  colorTextInverse: string;

  // Typography
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  fontDisplayWeight: string;
  fontBodyWeight: string;
  fontDisplayStyle: string;
  letterSpacingDisplay: string;
  letterSpacingBody: string;
  lineHeightBody: string;

  // Spacing & layout
  borderRadius: string;
  borderRadiusButton: string;
  borderRadiusInput: string;
  sectionPaddingY: string;
  containerMaxWidth: string;

  // Buttons
  buttonStyle: string;
  buttonTextTransform: string;
  buttonLetterSpacing: string;
  buttonBorderWidth: string;
  buttonFontFamily: string;

  // Motion
  transitionSpeed: string;
  transitionEasing: string;
  hoverEffect: string;
  scrollAnimation: string;
  animationStagger: string;

  // Decorative
  backgroundTexture: string;
  dividerStyle: string;
  cardStyle: string;
  heroOverlay: string;
}

export interface SiteStyleDefinition {
  styleKey: string;
  name: string;
  category: string;
  description: string;
  tokens: StyleTokens;
  sortOrder: number;
}

export type StyleCategoryFilter = "All" | "Music" | "Visual Art" | "Literary & Film" | "Universal";
