"use client";

import type { AlbumShowcaseBlockData, MusicPlatform } from "@/lib/types/builder";

const PLATFORM_LABELS: Record<MusicPlatform, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  youtube: "YouTube",
  website: "Website",
};

const RELEASE_TYPE_LABELS: Record<string, string> = {
  album: "Album",
  ep: "EP",
  single: "Single",
  mixtape: "Mixtape",
};

function AlbumArtPlaceholder() {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        backgroundColor: "var(--st-color-surface, #1A1712)",
        border: "1px dashed color-mix(in srgb, var(--st-color-accent, #C9A84C) 30%, transparent)",
        borderRadius: "var(--st-border-radius, 2px)",
        minHeight: "200px",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        style={{ color: "var(--st-color-text-muted, #8A8070)" }}
        aria-hidden="true"
      >
        <circle cx="9" cy="18" r="3" />
        <circle cx="18" cy="15" r="3" />
        <polyline points="12 18 12 8 21 5" />
        <line x1="9" y1="15" x2="9" y2="9" />
      </svg>
    </div>
  );
}

function AlbumContent({ data }: { data: AlbumShowcaseBlockData }) {
  const releaseLabel = data.releaseType ? RELEASE_TYPE_LABELS[data.releaseType] : null;

  return (
    <div className="space-y-5">
      <div>
        {(releaseLabel || data.releaseYear) && (
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: "var(--st-color-accent, #C9A84C)" }}
          >
            {[releaseLabel, data.releaseYear].filter(Boolean).join(" · ")}
          </p>
        )}
        <h2
          className="font-bold leading-tight"
          style={{
            color: "var(--st-color-heading, #F5F0E8)",
            fontFamily: "var(--st-font-display, serif)",
            fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
          }}
        >
          {data.albumTitle || "Album Title"}
        </h2>
        {data.artistName && (
          <p className="mt-1 text-base" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
            {data.artistName}
          </p>
        )}
      </div>

      {data.description && (
        <p
          className="leading-relaxed"
          style={{
            color: "var(--st-color-text, #D4C9B0)",
            fontSize: "var(--st-font-size-body, 1rem)",
            lineHeight: "var(--st-line-height-body, 1.75)",
          }}
        >
          {data.description}
        </p>
      )}

      {data.tracklist && data.tracklist.length > 0 && (
        <div
          className="border-t"
          style={{ borderColor: "var(--st-color-border, rgba(201,168,76,0.15))" }}
        >
          {data.tracklist.map((track, i) => (
            <div
              key={track.id}
              className="flex items-center justify-between py-2.5 border-b"
              style={{ borderColor: "var(--st-color-border, rgba(201,168,76,0.15))" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs w-5 text-right tabular-nums"
                  style={{ color: "var(--st-color-text-muted, #8A8070)" }}
                >
                  {i + 1}
                </span>
                <span className="text-sm" style={{ color: "var(--st-color-text, #D4C9B0)" }}>
                  {track.title}
                </span>
              </div>
              {track.duration && (
                <span
                  className="text-xs tabular-nums"
                  style={{ color: "var(--st-color-text-muted, #8A8070)" }}
                >
                  {track.duration}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {data.streamingLinks && data.streamingLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.streamingLinks.map((link) => (
            <a
              key={link.id}
              href={link.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                color: "var(--st-color-accent, #C9A84C)",
                border: "1px solid color-mix(in srgb, var(--st-color-accent, #C9A84C) 40%, transparent)",
                borderRadius: "var(--st-border-radius, 2px)",
              }}
            >
              {PLATFORM_LABELS[link.platform]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function AlbumShowcaseBlock({
  data,
}: {
  data: AlbumShowcaseBlockData;
  isEditing?: boolean;
}) {
  const isCenter = (data.layout ?? "left") === "center";

  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div className="max-w-5xl mx-auto">
        {isCenter ? (
          <div className="flex flex-col items-center gap-8">
            <div className="w-72 h-72 flex-shrink-0">
              {data.albumArt ? (
                <img
                  src={data.albumArt}
                  alt={data.albumTitle}
                  className="w-full h-full object-cover shadow-2xl"
                  style={{
                    borderRadius: "var(--st-border-radius, 2px)",
                    objectPosition: `${data.albumArtFocusX ?? 50}% ${data.albumArtFocusY ?? 50}%`,
                  }}
                />
              ) : (
                <div className="w-full h-full">
                  <AlbumArtPlaceholder />
                </div>
              )}
            </div>
            <div className="text-center max-w-xl w-full">
              <AlbumContent data={data} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="w-full md:w-72 flex-shrink-0">
              {data.albumArt ? (
                <img
                  src={data.albumArt}
                  alt={data.albumTitle}
                  className="w-full aspect-square object-cover shadow-2xl"
                  style={{
                    borderRadius: "var(--st-border-radius, 2px)",
                    objectPosition: `${data.albumArtFocusX ?? 50}% ${data.albumArtFocusY ?? 50}%`,
                  }}
                />
              ) : (
                <div className="w-full aspect-square">
                  <AlbumArtPlaceholder />
                </div>
              )}
            </div>
            <div className="flex-1">
              <AlbumContent data={data} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
