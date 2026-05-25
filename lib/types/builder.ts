export type BlockType =
  | "hero"
  | "text"
  | "feature_grid"
  | "testimonial"
  | "pricing_card"
  | "image_text"
  | "guarantee"
  | "cta_banner"
  | "video_embed"
  | "spacer"
  | "divider"
  | "corner_nav"
  | "application_form"
  | "music_embed"
  | "album_showcase"
  | "discography"
  | "simple_form";

export type SocialPlatform =
  | "instagram"
  | "spotify"
  | "youtube"
  | "tiktok"
  | "twitter"
  | "facebook"
  | "soundcloud"
  | "apple_music"
  | "bandcamp"
  | "website";

export interface HeroBlockData {
  headline: string;
  subheadline?: string;
  paragraph?: string;
  backgroundType?: "image" | "video";
  backgroundImage?: string;
  backgroundFocusX?: number; // 0-100
  backgroundFocusY?: number; // 0-100
  backgroundVideo?: string;
  ctaText?: string;
  ctaLink?: string;
  overlay?: boolean;
  height?: "sm" | "md" | "lg" | "full";
  textAlign?: "left" | "center" | "right";
}

export interface TextBlockData {
  content: string;
  alignment?: "left" | "center" | "right";
  size?: "sm" | "base" | "lg" | "xl";
  maxWidth?: boolean;
}

export interface FeatureGridBlockData {
  columns: 2 | 3 | 4;
  heading?: string;
  subheading?: string;
  features: Array<{
    id: string;
    icon?: string;
    title: string;
    description: string;
  }>;
}

export interface TestimonialBlockData {
  heading?: string;
  testimonials: Array<{
    id: string;
    quote: string;
    name: string;
    title?: string;
    avatar?: string;
    avatarFocusX?: number;
    avatarFocusY?: number;
  }>;
}

export interface PricingTier {
  id: string;
  heading?: string;
  badge?: string;
  imageUrl?: string;
  imageFocusX?: number;
  imageFocusY?: number;
  price: string;
  originalPrice?: string;
  period?: string;
  description?: string;
  features: string[];
  featureIcon?: string;
  ctaText: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  guarantee?: string;
  stripePriceId?: string;
  stripeMode?: "payment" | "subscription";
  highlight?: boolean;
  buttonStyle?: "solid" | "outline";
}

export interface PricingCardBlockData {
  // Block-level
  sectionHeading?: string;
  sectionSubheading?: string;
  footerText?: string;
  layout?: "center" | "left";
  cardWidth?: "sm" | "md" | "lg"; // used only when tiers.length === 1
  // Tiers (new format)
  tiers?: PricingTier[];
  // Legacy single-tier fields (migration fallback — not written by new code)
  heading?: string;
  badge?: string;
  imageUrl?: string;
  imageFocusX?: number;
  imageFocusY?: number;
  price?: string;
  originalPrice?: string;
  period?: string;
  description?: string;
  features?: string[];
  featureIcon?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  guarantee?: string;
  stripePriceId?: string;
  stripeMode?: "payment" | "subscription";
  highlight?: boolean;
  buttonStyle?: "solid" | "outline";
}

export interface ImageTextBlockData {
  imagePosition: "left" | "right";
  image?: string;
  imageFocusX?: number;
  imageFocusY?: number;
  heading?: string;
  subheading?: string;
  body: string;
  ctaText?: string;
  ctaLink?: string;
}

export interface GuaranteeBlockData {
  heading: string;
  body: string;
  icon?: string;
}

export interface CTABannerBlockData {
  heading: string;
  subheading?: string;
  ctaText: string;
  ctaLink?: string;
  background?: "gold" | "dark" | "brand";
}

export interface VideoEmbedBlockData {
  url: string;
  caption?: string;
}

export interface SpacerBlockData {
  height: "sm" | "md" | "lg" | "xl";
}

export interface DividerBlockData {
  style: "line" | "dotted" | "gradient";
  width?: "full" | "centered";
}

export interface CornerNavBlockData {
  artistName?: string;
  backgroundType?: "color" | "image" | "video";
  backgroundImage?: string;
  backgroundFocusX?: number;
  backgroundFocusY?: number;
  backgroundVideo?: string;
  backgroundColor?: string;
  overlayOpacity?: number; // 0–100
  topLeftLabel?: string;
  topLeftUrl?: string;
  topRightLabel?: string;
  topRightUrl?: string;
  bottomLeftLabel?: string;
  bottomLeftUrl?: string;
  bottomRightLabel?: string;
  bottomRightUrl?: string;
  socialLinks?: Array<{ id: string; platform: SocialPlatform; url: string }>;
  linkColor?: string;
  linkSize?: number; // px, default ~11
  socialIconColor?: string;
  socialIconSize?: number; // px, default 15
}

export type FormFieldType = "short_text" | "long_text" | "multiple_choice" | "select_multiple" | "email" | "phone" | "rating";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  choices?: string[];
  maxRating?: number;
}

export type MusicPlatform = "spotify" | "apple_music" | "soundcloud" | "bandcamp" | "youtube" | "website";

export interface MusicEmbedBlockData {
  url: string;
  caption?: string;
  size?: "compact" | "full";
}

export interface AlbumShowcaseBlockData {
  albumArt?: string;
  albumArtFocusX?: number;
  albumArtFocusY?: number;
  albumTitle: string;
  artistName?: string;
  releaseYear?: string;
  releaseType?: "album" | "ep" | "single" | "mixtape";
  description?: string;
  tracklist?: Array<{ id: string; title: string; duration?: string }>;
  streamingLinks?: Array<{ id: string; platform: MusicPlatform; url: string }>;
  layout?: "left" | "center";
}

export interface DiscographyBlockData {
  heading?: string;
  subheading?: string;
  columns?: 2 | 3 | 4;
  releases: Array<{
    id: string;
    artwork?: string;
    title: string;
    year?: string;
    type?: "album" | "ep" | "single" | "mixtape";
    url?: string;
  }>;
}

export interface SimpleFormBlockData {
  heading?: string;
  subheading?: string;
  fields?: Array<{
    id: string;
    type: "text" | "email" | "phone" | "textarea";
    label: string;
    placeholder?: string;
    required?: boolean;
    halfWidth?: boolean;
  }>;
  submitText?: string;
  successMessage?: string;
  notificationEmail?: string;
}

export interface ApplicationFormBlockData {
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  welcomeButtonText?: string;
  questions?: FormField[];
  thankYouTitle?: string;
  thankYouMessage?: string;
  submitButtonText?: string;
  notificationEmail?: string;
}

export type BlockData =
  | HeroBlockData
  | TextBlockData
  | FeatureGridBlockData
  | TestimonialBlockData
  | PricingCardBlockData
  | ImageTextBlockData
  | GuaranteeBlockData
  | CTABannerBlockData
  | VideoEmbedBlockData
  | SpacerBlockData
  | DividerBlockData
  | CornerNavBlockData
  | ApplicationFormBlockData
  | MusicEmbedBlockData
  | AlbumShowcaseBlockData
  | DiscographyBlockData
  | SimpleFormBlockData;

export interface Block {
  id: string;
  type: BlockType;
  data: BlockData;
}

export type PageData = Block[];

export interface PageTheme {
  accentColor: string;
  background: "dark" | "light" | "custom";
  backgroundColor?: string;
  fontPairing: "editorial" | "modern" | "bold";
}

export const DEFAULT_THEME: PageTheme = {
  accentColor: "#C9A84C",
  background: "dark",
  fontPairing: "editorial",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  text: "Text Block",
  feature_grid: "Feature Grid",
  testimonial: "Testimonials",
  pricing_card: "Pricing Card",
  image_text: "Image + Text",
  guarantee: "Guarantee",
  cta_banner: "CTA Banner",
  video_embed: "Video Embed",
  spacer: "Spacer",
  divider: "Divider",
  corner_nav: "Corner Nav Homepage",
  application_form: "Application Form",
  music_embed: "Music Embed",
  album_showcase: "Album Showcase",
  discography: "Discography",
  simple_form: "Simple Form",
};

export function createBlock(type: BlockType): Block {
  const id = crypto.randomUUID();
  const defaults: Record<BlockType, BlockData> = {
    hero: {
      headline: "Your Compelling Headline Here",
      subheadline: "A brief, powerful description of what you offer and why it matters.",
      ctaText: "Get Started",
      height: "lg",
      textAlign: "center",
      overlay: true,
    } as HeroBlockData,
    text: {
      content: "<p>Write your story here. This is a flexible text block for any body content.</p>",
      alignment: "left",
      size: "base",
      maxWidth: true,
    } as TextBlockData,
    feature_grid: {
      columns: 3,
      heading: "Everything You Get",
      features: [
        { id: crypto.randomUUID(), icon: "✦", title: "Feature One", description: "Describe the benefit of this feature in one or two sentences." },
        { id: crypto.randomUUID(), icon: "✦", title: "Feature Two", description: "Describe the benefit of this feature in one or two sentences." },
        { id: crypto.randomUUID(), icon: "✦", title: "Feature Three", description: "Describe the benefit of this feature in one or two sentences." },
      ],
    } as FeatureGridBlockData,
    testimonial: {
      heading: "What People Are Saying",
      testimonials: [
        { id: crypto.randomUUID(), quote: "This changed everything for me. I cannot imagine going back.", name: "Jane Smith", title: "Artist & Creator" },
        { id: crypto.randomUUID(), quote: "Worth every penny. My work improved dramatically within weeks.", name: "Marcus Lee", title: "Musician" },
      ],
    } as TestimonialBlockData,
    pricing_card: {
      heading: "Join Today",
      price: "$297",
      period: "one-time",
      description: "Everything you need to move your creative work forward.",
      features: ["Full access to the program", "Lifetime updates", "Community support", "1-on-1 onboarding call"],
      ctaText: "Enroll Now",
      highlight: true,
    } as PricingCardBlockData,
    image_text: {
      imagePosition: "left",
      heading: "The Story Behind This Work",
      body: "Share the context, the journey, or the philosophy behind what you're offering. Let people connect with the human behind the work.",
      ctaText: "Learn More",
    } as ImageTextBlockData,
    guarantee: {
      heading: "30-Day Guarantee",
      body: "If you're not completely satisfied within 30 days, we'll refund every penny. No questions asked.",
      icon: "🛡️",
    } as GuaranteeBlockData,
    cta_banner: {
      heading: "Ready to Begin?",
      subheading: "Spots are limited. Join the community that's moving creative work forward.",
      ctaText: "Get Started Today",
      background: "gold",
    } as CTABannerBlockData,
    video_embed: {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      caption: "Watch the full overview",
    } as VideoEmbedBlockData,
    spacer: { height: "md" } as SpacerBlockData,
    divider: { style: "gradient", width: "centered" } as DividerBlockData,
    corner_nav: {
      artistName: "Artist Name",
      backgroundType: "color",
      backgroundColor: "#0E0C09",
      overlayOpacity: 0,
      topLeftLabel: "Tour",
      topLeftUrl: "#",
      topRightLabel: "Listen",
      topRightUrl: "#",
      bottomLeftLabel: "Shop",
      bottomLeftUrl: "#",
      bottomRightLabel: "Contact",
      bottomRightUrl: "#",
      socialLinks: [
        { id: crypto.randomUUID(), platform: "instagram" as const, url: "#" },
        { id: crypto.randomUUID(), platform: "spotify" as const, url: "#" },
        { id: crypto.randomUUID(), platform: "youtube" as const, url: "#" },
      ],
    } as CornerNavBlockData,
    music_embed: {
      url: "",
      size: "full",
    } as MusicEmbedBlockData,
    album_showcase: {
      albumTitle: "Album Title",
      artistName: "Artist Name",
      releaseYear: new Date().getFullYear().toString(),
      releaseType: "album",
      layout: "left",
      tracklist: [
        { id: crypto.randomUUID(), title: "Track One", duration: "3:24" },
        { id: crypto.randomUUID(), title: "Track Two", duration: "4:01" },
        { id: crypto.randomUUID(), title: "Track Three", duration: "3:47" },
      ],
      streamingLinks: [
        { id: crypto.randomUUID(), platform: "spotify" as const, url: "" },
        { id: crypto.randomUUID(), platform: "apple_music" as const, url: "" },
      ],
    } as AlbumShowcaseBlockData,
    simple_form: {
      heading: "Get in Touch",
      subheading: "Fill out the form below and I'll get back to you soon.",
      fields: [
        { id: crypto.randomUUID(), type: "text" as const, label: "Name", placeholder: "Your name", required: true, halfWidth: true },
        { id: crypto.randomUUID(), type: "email" as const, label: "Email", placeholder: "your@email.com", required: true, halfWidth: true },
        { id: crypto.randomUUID(), type: "text" as const, label: "Subject", placeholder: "What's this about?", required: false, halfWidth: false },
        { id: crypto.randomUUID(), type: "textarea" as const, label: "Message", placeholder: "Your message…", required: true, halfWidth: false },
      ],
      submitText: "Send Message",
      successMessage: "Thanks for your message! I'll be in touch soon.",
    } as SimpleFormBlockData,
    discography: {
      heading: "Discography",
      columns: 3,
      releases: [
        { id: crypto.randomUUID(), title: "Album Title", year: "2024", type: "album" as const },
        { id: crypto.randomUUID(), title: "EP Title", year: "2023", type: "ep" as const },
        { id: crypto.randomUUID(), title: "Single", year: "2022", type: "single" as const },
      ],
    } as DiscographyBlockData,
    application_form: {
      welcomeTitle: "Apply to Join",
      welcomeSubtitle: "Tell us a little about yourself and your creative practice. Takes about 3 minutes.",
      welcomeButtonText: "Start Application",
      questions: [
        { id: crypto.randomUUID(), type: "short_text" as const, label: "What's your name?", placeholder: "Your full name", required: true },
        { id: crypto.randomUUID(), type: "email" as const, label: "What's your email address?", placeholder: "name@example.com", required: true },
        { id: crypto.randomUUID(), type: "long_text" as const, label: "Tell us about your creative practice.", description: "What do you make? How long have you been doing it?", placeholder: "I've been…", required: true },
        { id: crypto.randomUUID(), type: "multiple_choice" as const, label: "What's your biggest challenge right now?", required: true, choices: ["Consistency and showing up", "Finding an audience", "Monetizing my work", "Creative blocks"] },
        { id: crypto.randomUUID(), type: "long_text" as const, label: "Why do you want to join this program?", placeholder: "I'm hoping to…", required: true },
      ],
      thankYouTitle: "Application Received",
      thankYouMessage: "Thank you for applying. We review applications personally and will be in touch within a few days.",
      submitButtonText: "Submit Application",
    } as ApplicationFormBlockData,
  };
  return { id, type, data: defaults[type] };
}
