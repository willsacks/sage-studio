"use client";

import { Globe } from "lucide-react";
import {
  FaInstagram, FaSpotify, FaYoutube, FaTiktok, FaXTwitter,
  FaFacebook, FaSoundcloud, FaApple, FaBandcamp,
} from "react-icons/fa6";
import type { CornerNavBlockData, SocialPlatform } from "@/lib/types/builder";
import type React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = React.ComponentType<any>;

const PLATFORM_ICONS: Record<SocialPlatform, IconComponent> = {
  instagram: FaInstagram,
  spotify: FaSpotify,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  twitter: FaXTwitter,
  facebook: FaFacebook,
  soundcloud: FaSoundcloud,
  apple_music: FaApple,
  bandcamp: FaBandcamp,
  website: Globe,
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  spotify: "Spotify",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitter: "Twitter",
  facebook: "Facebook",
  soundcloud: "SoundCloud",
  apple_music: "Apple Music",
  bandcamp: "Bandcamp",
  website: "Website",
};

// Resolve a stored link against the site's basePath.
// Strips legacy /sites/slug/ prefixes so old data works correctly on custom domains.
function resolveLink(url: string | undefined, basePath: string): string {
  if (!url) return "#";
  if (url.startsWith("http") || url.startsWith("mailto:")) return url;
  const normalized = url.replace(/^\/sites\/[^/]+/, ""); // strip /sites/slug prefix
  return `${basePath}${normalized || "/"}`;
}

export function CornerNavBlock({
  data,
  isEditing,
  basePath = "",
}: {
  data: CornerNavBlockData;
  isEditing?: boolean;
  basePath?: string;
}) {
  const height = isEditing ? "80vh" : "100vh";
  const bgType = data.backgroundType ?? "color";
  const focusX = data.backgroundFocusX ?? 50;
  const focusY = data.backgroundFocusY ?? 50;
  const overlayOpacity = (data.overlayOpacity ?? 0) / 100;

  const linkColor = data.linkColor ?? "var(--st-color-text, #F5F0E8)";
  const linkFontSize = data.linkSize ? `${data.linkSize}px` : "clamp(0.65rem, 1.1vw, 0.8rem)";
  const socialIconColor = data.socialIconColor ?? "var(--st-color-text, #F5F0E8)";
  const socialIconSize = data.socialIconSize ?? 15;

  const linkStyle: React.CSSProperties = {
    color: linkColor,
    fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
    fontSize: linkFontSize,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    textDecoration: "none",
    opacity: 0.8,
    transition: "opacity 0.2s ease",
    lineHeight: 1,
  };

  function NavLink({ label, url }: { label?: string; url?: string }) {
    if (!label) return <span />;
    return (
      <a
        href={resolveLink(url, basePath)}
        style={linkStyle}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.8")}
        onClick={isEditing ? (e) => e.preventDefault() : undefined}
        aria-label={label}
      >
        {label}
      </a>
    );
  }

  return (
    <section
      className="relative overflow-hidden w-full"
      style={{
        minHeight: height,
        ...(bgType === "image" && data.backgroundImage
          ? {
              backgroundImage: `url(${data.backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: `${focusX}% ${focusY}%`,
            }
          : {}),
        backgroundColor:
          bgType === "color"
            ? (data.backgroundColor ?? "var(--st-color-background, #0E0C09)")
            : "var(--st-color-background, #0E0C09)",
      }}
    >
      {/* Video background */}
      {bgType === "video" && data.backgroundVideo && (
        <video
          src={data.backgroundVideo}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `${focusX}% ${focusY}%` }}
          autoPlay
          muted
          loop
          playsInline
        />
      )}

      {/* Overlay */}
      {overlayOpacity > 0 && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
        />
      )}

      {/* Layout grid */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{ padding: "clamp(1.5rem, 4vw, 3rem)" }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between">
          <NavLink label={data.topLeftLabel} url={data.topLeftUrl} />
          <NavLink label={data.topRightLabel} url={data.topRightUrl} />
        </div>

        {/* Center — artist name */}
        <div className="flex-1 flex items-center justify-center">
          {data.artistName && (
            <h1
              style={{
                fontFamily: `var(--st-font-display, "Playfair Display"), serif`,
                fontStyle: "var(--st-font-display-style, italic)" as React.CSSProperties["fontStyle"],
                fontWeight: "var(--st-font-display-weight, 300)" as React.CSSProperties["fontWeight"],
                color: "var(--st-color-text, #F5F0E8)",
                fontSize: "clamp(2.5rem, 9vw, 7rem)",
                letterSpacing: "var(--st-letter-spacing-display, 0.02em)",
                textAlign: "center",
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              {data.artistName}
            </h1>
          )}
        </div>

        {/* Bottom row — left link | social icons | right link */}
        <div className="flex items-end justify-between">
          <div style={{ minWidth: "6rem" }}>
            <NavLink label={data.bottomLeftLabel} url={data.bottomLeftUrl} />
          </div>

          {data.socialLinks && data.socialLinks.length > 0 && (
            <div className="flex items-center" style={{ gap: "clamp(1rem, 2.5vw, 1.75rem)" }}>
              {data.socialLinks.map((link) => {
                const Icon = PLATFORM_ICONS[link.platform];
                return (
                  <a
                    key={link.id}
                    href={resolveLink(link.url, basePath)}
                    aria-label={PLATFORM_LABELS[link.platform]}
                    style={{
                      color: socialIconColor,
                      opacity: 0.7,
                      transition: "opacity 0.2s ease",
                      display: "flex",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.7")}
                    onClick={isEditing ? (e) => e.preventDefault() : undefined}
                  >
                    <Icon size={socialIconSize} strokeWidth={1.25} />
                  </a>
                );
              })}
            </div>
          )}

          <div style={{ minWidth: "6rem", textAlign: "right" }}>
            <NavLink label={data.bottomRightLabel} url={data.bottomRightUrl} />
          </div>
        </div>
      </div>
    </section>
  );
}
