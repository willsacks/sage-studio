import type { BlockType, PageData } from "@/lib/types/builder";
import { createBlock } from "@/lib/types/builder";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SitePageType = "home" | "about" | "work" | "contact" | "custom";

export interface SitePageTemplate {
  key: string;
  name: string;
  description: string;
  pageType: SitePageType;
  blockTypes: BlockType[]; // drives the layout preview
  createPageData: () => PageData;
}

// ─── Preview rendering ────────────────────────────────────────────────────────

function blockStrip(type: BlockType, i: number): React.ReactNode {
  switch (type) {
    case "hero":
      return (
        <div key={i} className="flex-shrink-0 w-full bg-current opacity-10 rounded flex flex-col items-center justify-center gap-0.5 px-1" style={{ height: "30%" }}>
          <div className="h-1.5 bg-current opacity-60 rounded w-2/3" />
          <div className="h-1 bg-current opacity-35 rounded w-2/5" />
          <div className="h-1.5 bg-current opacity-45 rounded w-1/4 mt-0.5" />
        </div>
      );
    case "corner_nav":
      return (
        <div key={i} className="flex-1 min-h-0 w-full bg-current opacity-10 rounded relative">
          <div className="absolute top-1 left-1 h-0.5 w-1/4 bg-current opacity-45 rounded" />
          <div className="absolute top-1 right-1 h-0.5 w-1/4 bg-current opacity-45 rounded" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2/5 bg-current opacity-55 rounded" />
          </div>
          <div className="absolute bottom-1 left-1 h-0.5 w-1/4 bg-current opacity-45 rounded" />
          <div className="absolute bottom-1 right-1 h-0.5 w-1/4 bg-current opacity-45 rounded" />
        </div>
      );
    case "text":
      return (
        <div key={i} className="flex-shrink-0 py-0.5 space-y-0.5">
          <div className="h-0.5 bg-current opacity-25 rounded w-full" />
          <div className="h-0.5 bg-current opacity-20 rounded w-11/12" />
          <div className="h-0.5 bg-current opacity-20 rounded w-4/5" />
        </div>
      );
    case "feature_grid":
      return (
        <div key={i} className="flex-shrink-0 py-0.5">
          <div className="grid grid-cols-3 gap-0.5">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-3.5 bg-current opacity-15 rounded" />
            ))}
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div key={i} className="flex-shrink-0 py-0.5">
          <div className="flex gap-0.5">
            <div className="flex-1 h-4 bg-current opacity-10 rounded border border-current/10" />
            <div className="flex-1 h-4 bg-current opacity-10 rounded border border-current/10" />
          </div>
        </div>
      );
    case "pricing_card":
      return (
        <div key={i} className="flex-shrink-0 py-0.5 flex justify-center">
          <div className="w-1/2 h-6 bg-current opacity-15 rounded border border-current/20 flex flex-col items-center justify-center gap-0.5">
            <div className="h-1 bg-current opacity-45 rounded w-2/3" />
            <div className="h-0.5 bg-current opacity-25 rounded w-1/2" />
            <div className="h-1.5 bg-current opacity-35 rounded w-2/5" />
          </div>
        </div>
      );
    case "image_text":
      return (
        <div key={i} className="flex-shrink-0 flex gap-0.5" style={{ height: "22%" }}>
          <div className="w-2/5 bg-current opacity-15 rounded flex-shrink-0" />
          <div className="flex-1 py-0.5 space-y-0.5">
            <div className="h-1 bg-current opacity-30 rounded w-3/4" />
            <div className="h-0.5 bg-current opacity-20 rounded w-full" />
            <div className="h-0.5 bg-current opacity-20 rounded w-5/6" />
            <div className="h-0.5 bg-current opacity-20 rounded w-2/3" />
          </div>
        </div>
      );
    case "cta_banner":
      return (
        <div key={i} className="flex-shrink-0 py-0.5">
          <div className="w-full h-4 bg-current opacity-20 rounded flex items-center justify-center gap-1">
            <div className="h-0.5 w-2/5 bg-current opacity-40 rounded" />
            <div className="h-2 w-1/5 bg-current opacity-55 rounded" />
          </div>
        </div>
      );
    case "video_embed":
      return (
        <div key={i} className="flex-shrink-0 py-0.5">
          <div className="w-full h-5 bg-current opacity-10 rounded flex items-center justify-center">
            <div className="w-0 h-0 opacity-40" style={{ borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid currentColor" }} />
          </div>
        </div>
      );
    case "music_embed":
      return (
        <div key={i} className="flex-shrink-0 py-0.5">
          <div className="w-full h-3.5 bg-current opacity-10 rounded border border-current/15 flex items-center px-1 gap-0.5">
            <div className="w-2.5 h-2.5 bg-current opacity-25 rounded-sm flex-shrink-0" />
            <div className="flex-1 h-0.5 bg-current opacity-20 rounded" />
          </div>
        </div>
      );
    case "album_showcase":
      return (
        <div key={i} className="flex-shrink-0 flex gap-0.5" style={{ height: "22%" }}>
          <div className="flex-shrink-0 bg-current opacity-15 rounded" style={{ width: "30%", aspectRatio: "1" }} />
          <div className="flex-1 py-0.5 space-y-0.5">
            <div className="h-1 bg-current opacity-35 rounded w-2/3" />
            <div className="h-0.5 bg-current opacity-20 rounded w-full" />
            <div className="h-0.5 bg-current opacity-20 rounded w-5/6" />
            <div className="h-0.5 bg-current opacity-20 rounded w-full" />
          </div>
        </div>
      );
    case "discography":
      return (
        <div key={i} className="flex-shrink-0 py-0.5">
          <div className="grid grid-cols-4 gap-0.5">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="aspect-square bg-current opacity-15 rounded" />
            ))}
          </div>
        </div>
      );
    case "application_form":
      return (
        <div key={i} className="flex-shrink-0 py-0.5 space-y-0.5">
          <div className="h-1.5 bg-current opacity-10 rounded border border-current/15 w-full" />
          <div className="h-1.5 bg-current opacity-10 rounded border border-current/15 w-full" />
          <div className="h-3 bg-current opacity-10 rounded border border-current/15 w-full" />
          <div className="h-1.5 bg-current opacity-25 rounded w-1/3" />
        </div>
      );
    case "simple_form":
      return (
        <div key={i} className="flex-shrink-0 py-0.5 space-y-0.5">
          <div className="grid grid-cols-2 gap-0.5">
            <div className="h-1.5 bg-current opacity-10 rounded border border-current/15" />
            <div className="h-1.5 bg-current opacity-10 rounded border border-current/15" />
          </div>
          <div className="h-1.5 bg-current opacity-10 rounded border border-current/15 w-full" />
          <div className="h-2.5 bg-current opacity-10 rounded border border-current/15 w-full" />
          <div className="h-1.5 bg-current opacity-25 rounded w-1/4" />
        </div>
      );
    case "guarantee":
      return (
        <div key={i} className="flex-shrink-0 py-0.5 flex justify-center">
          <div className="w-2/3 h-4 bg-current opacity-10 rounded border border-current/20 flex items-center justify-center">
            <div className="h-0.5 bg-current opacity-30 rounded w-1/2" />
          </div>
        </div>
      );
    case "divider":
      return <div key={i} className="flex-shrink-0 h-px w-full bg-current opacity-20 my-0.5" />;
    case "spacer":
      return <div key={i} className="flex-shrink-0 h-1" />;
    default:
      return <div key={i} className="flex-shrink-0 h-2 bg-current opacity-10 rounded my-0.5 w-full" />;
  }
}

export function LayoutPreview({ types }: { types: BlockType[] }) {
  if (types.includes("corner_nav")) {
    return (
      <div className="w-full h-full p-1.5">
        {blockStrip("corner_nav", 0)}
      </div>
    );
  }
  const shown = types.slice(0, 7);
  return (
    <div className="w-full h-full flex flex-col gap-0.5 p-1.5 overflow-hidden">
      {shown.map((type, i) => blockStrip(type, i))}
    </div>
  );
}

// ─── Template factory helper ──────────────────────────────────────────────────

type BlockOverride = Record<string, unknown>;

function buildPageData(types: BlockType[], overrides?: Record<number, BlockOverride>): PageData {
  return types.map((type, i) => {
    const block = createBlock(type);
    if (overrides?.[i]) Object.assign(block.data as Record<string, unknown>, overrides[i]);
    return block;
  });
}

// ─── Home templates ───────────────────────────────────────────────────────────

export const HOME_TEMPLATES: SitePageTemplate[] = [
  {
    key: "home-corner-nav",
    name: "Artist Homepage",
    description: "Fullscreen homepage with corner navigation — the classic artist landing",
    pageType: "home",
    blockTypes: ["corner_nav"],
    createPageData: () => buildPageData(["corner_nav"]),
  },
  {
    key: "home-landing",
    name: "Landing Page",
    description: "Hero, highlights, and a clear call to action",
    pageType: "home",
    blockTypes: ["hero", "feature_grid", "cta_banner"],
    createPageData: () =>
      buildPageData(["hero", "feature_grid", "cta_banner"], {
        0: { headline: "Your Name Here", subheadline: "Artist · Creator · Collaborator", height: "lg" },
        1: { heading: "What I Do" },
        2: { heading: "Ready to Work Together?" },
      }),
  },
  {
    key: "home-story",
    name: "Story First",
    description: "Lead with your narrative — image, voice, and context",
    pageType: "home",
    blockTypes: ["hero", "image_text", "text"],
    createPageData: () =>
      buildPageData(["hero", "image_text", "text"], {
        0: { headline: "Your Name Here", height: "md" },
        1: { heading: "The Story Behind the Work" },
      }),
  },
  {
    key: "home-music",
    name: "Music First",
    description: "Lead with your music — hero, embedded player, and a CTA",
    pageType: "home",
    blockTypes: ["hero", "music_embed", "cta_banner"],
    createPageData: () =>
      buildPageData(["hero", "music_embed", "cta_banner"], {
        0: { headline: "Press Play", height: "md" },
        2: { heading: "Hear More" },
      }),
  },
  {
    key: "home-press",
    name: "Press Ready",
    description: "Social proof front and centre — hero with testimonials below",
    pageType: "home",
    blockTypes: ["hero", "testimonial", "cta_banner"],
    createPageData: () =>
      buildPageData(["hero", "testimonial", "cta_banner"], {
        0: { headline: "Your Name Here", height: "lg" },
        1: { heading: "What People Are Saying" },
      }),
  },
];

// ─── About templates ──────────────────────────────────────────────────────────

export const ABOUT_TEMPLATES: SitePageTemplate[] = [
  {
    key: "about-portrait",
    name: "Portrait Bio",
    description: "Photo with written bio — clean and personal",
    pageType: "about",
    blockTypes: ["image_text", "text"],
    createPageData: () =>
      buildPageData(["image_text", "text"], {
        0: { heading: "About Me", body: "<p>Write your bio here. Tell the story of your practice, your influences, and what drives your work.</p>" },
      }),
  },
  {
    key: "about-statement",
    name: "Artist Statement",
    description: "Hero image with a focused written statement below",
    pageType: "about",
    blockTypes: ["hero", "text", "feature_grid"],
    createPageData: () =>
      buildPageData(["hero", "text", "feature_grid"], {
        0: { headline: "About", height: "sm" },
        2: { heading: "Highlights", columns: 3 },
      }),
  },
  {
    key: "about-press-bio",
    name: "Press Bio",
    description: "Bio copy with supporting press quotes",
    pageType: "about",
    blockTypes: ["text", "testimonial"],
    createPageData: () =>
      buildPageData(["text", "testimonial"], {
        1: { heading: "Press Quotes" },
      }),
  },
  {
    key: "about-visual",
    name: "Visual Story",
    description: "Photo-driven narrative in alternating sections",
    pageType: "about",
    blockTypes: ["hero", "image_text", "image_text"],
    createPageData: () =>
      buildPageData(["hero", "image_text", "image_text"], {
        0: { headline: "About", height: "sm" },
        1: { imagePosition: "left", heading: "The Work" },
        2: { imagePosition: "right", heading: "The Practice" },
      }),
  },
  {
    key: "about-minimal",
    name: "Minimal Bio",
    description: "Clean hero with a brief bio — nothing extra",
    pageType: "about",
    blockTypes: ["hero", "text"],
    createPageData: () =>
      buildPageData(["hero", "text"], {
        0: { headline: "About", height: "sm" },
        1: { alignment: "center", maxWidth: true },
      }),
  },
];

// ─── Work / Portfolio templates ───────────────────────────────────────────────

export const WORK_TEMPLATES: SitePageTemplate[] = [
  {
    key: "work-grid",
    name: "Portfolio Grid",
    description: "Feature grids showcasing multiple works or services",
    pageType: "work",
    blockTypes: ["hero", "feature_grid", "feature_grid"],
    createPageData: () =>
      buildPageData(["hero", "feature_grid", "feature_grid"], {
        0: { headline: "Work", height: "sm" },
        1: { heading: "Selected Projects", columns: 3 },
        2: { heading: "Services", columns: 3 },
      }),
  },
  {
    key: "work-case-studies",
    name: "Case Studies",
    description: "In-depth project writeups with alternating image and text",
    pageType: "work",
    blockTypes: ["image_text", "divider", "image_text", "divider", "image_text"],
    createPageData: () =>
      buildPageData(["image_text", "divider", "image_text", "divider", "image_text"], {
        0: { heading: "Project One", imagePosition: "left" },
        2: { heading: "Project Two", imagePosition: "right" },
        4: { heading: "Project Three", imagePosition: "left" },
      }),
  },
  {
    key: "work-music-catalog",
    name: "Music Catalog",
    description: "Featured release with full discography below",
    pageType: "work",
    blockTypes: ["album_showcase", "discography"],
    createPageData: () =>
      buildPageData(["album_showcase", "discography"], {
        0: { albumTitle: "Latest Release", layout: "left" },
        1: { heading: "Discography", columns: 3 },
      }),
  },
  {
    key: "work-video",
    name: "Video Reel",
    description: "Showreel or demo video with supporting text",
    pageType: "work",
    blockTypes: ["hero", "video_embed", "text"],
    createPageData: () =>
      buildPageData(["hero", "video_embed", "text"], {
        0: { headline: "Watch the Work", height: "sm" },
      }),
  },
  {
    key: "work-with-reviews",
    name: "Work + Reviews",
    description: "Showcase your work alongside client or audience testimonials",
    pageType: "work",
    blockTypes: ["hero", "image_text", "testimonial"],
    createPageData: () =>
      buildPageData(["hero", "image_text", "testimonial"], {
        0: { headline: "Work", height: "sm" },
        2: { heading: "What Clients Say" },
      }),
  },
];

// ─── Contact templates ────────────────────────────────────────────────────────

export const CONTACT_TEMPLATES: SitePageTemplate[] = [
  {
    key: "contact-simple-form",
    name: "Contact Form",
    description: "Clean simple contact form with name, email, and message",
    pageType: "contact",
    blockTypes: ["hero", "simple_form"],
    createPageData: () =>
      buildPageData(["hero", "simple_form"], {
        0: { headline: "Get in Touch", height: "sm" },
      }),
  },
  {
    key: "contact-application",
    name: "Application",
    description: "Curated multi-step inquiry form for selective bookings or programs",
    pageType: "contact",
    blockTypes: ["hero", "application_form"],
    createPageData: () =>
      buildPageData(["hero", "application_form"], {
        0: { headline: "Apply to Work Together", height: "sm" },
      }),
  },
  {
    key: "contact-connect",
    name: "Connect Hub",
    description: "Multiple ways to connect, shown in a clear grid",
    pageType: "contact",
    blockTypes: ["hero", "feature_grid", "cta_banner"],
    createPageData: () =>
      buildPageData(["hero", "feature_grid", "cta_banner"], {
        0: { headline: "Let's Connect", height: "sm" },
        1: { heading: "Ways to Reach Me", columns: 3 },
        2: { heading: "Or Send a Direct Message" },
      }),
  },
  {
    key: "contact-booking",
    name: "Booking Request",
    description: "Context and terms up top, inquiry form below",
    pageType: "contact",
    blockTypes: ["hero", "text", "simple_form"],
    createPageData: () =>
      buildPageData(["hero", "text", "simple_form"], {
        0: { headline: "Booking Enquiries", height: "sm" },
        1: { content: "<p>Thank you for your interest. Please fill out the form below and I'll get back to you within 48 hours.</p>" },
      }),
  },
  {
    key: "contact-press",
    name: "Press & Media",
    description: "Media contact details with bio and assets",
    pageType: "contact",
    blockTypes: ["hero", "image_text", "cta_banner"],
    createPageData: () =>
      buildPageData(["hero", "image_text", "cta_banner"], {
        0: { headline: "Press & Media", height: "sm" },
        1: { heading: "Media Kit", body: "<p>For press enquiries, interviews, and media requests, please get in touch using the details below.</p>" },
        2: { heading: "Download Press Kit", ctaText: "Download" },
      }),
  },
];

// ─── Flat export ──────────────────────────────────────────────────────────────

export const ALL_SITE_TEMPLATES: SitePageTemplate[] = [
  ...HOME_TEMPLATES,
  ...ABOUT_TEMPLATES,
  ...WORK_TEMPLATES,
  ...CONTACT_TEMPLATES,
];

export const TEMPLATES_BY_PAGE_TYPE: Record<SitePageType, SitePageTemplate[]> = {
  home: HOME_TEMPLATES,
  about: ABOUT_TEMPLATES,
  work: WORK_TEMPLATES,
  contact: CONTACT_TEMPLATES,
  custom: [],
};
