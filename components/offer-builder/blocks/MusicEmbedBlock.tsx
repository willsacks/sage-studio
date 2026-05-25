"use client";

import type { MusicEmbedBlockData } from "@/lib/types/builder";

type EmbedConfig = { src: string; height: number; title: string };

function getMusicEmbed(url: string, size: "compact" | "full"): EmbedConfig | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);

    // Spotify: open.spotify.com/track|album|playlist|artist/id
    if (parsed.hostname === "open.spotify.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const type = parts[0];
        const id = parts[1];
        const src = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
        const height = type === "track" && size === "compact" ? 80 : 352;
        return { src, height, title: `Spotify ${type}` };
      }
    }

    // Apple Music: music.apple.com/region/type/name/id
    if (parsed.hostname === "music.apple.com") {
      const src = url.replace("https://music.apple.com", "https://embed.music.apple.com");
      const parts = parsed.pathname.split("/").filter(Boolean);
      const type = parts[1]; // album, song, playlist, etc.
      const height = type === "song" || size === "compact" ? 175 : 450;
      return { src, height, title: "Apple Music" };
    }

    // SoundCloud: soundcloud.com/artist/track
    if (parsed.hostname === "soundcloud.com" || parsed.hostname === "www.soundcloud.com") {
      const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23C9A84C&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
      const height = size === "compact" ? 166 : 300;
      return { src, height, title: "SoundCloud" };
    }

    return null;
  } catch {
    return null;
  }
}

export function MusicEmbedBlock({
  data,
}: {
  data: MusicEmbedBlockData;
  isEditing?: boolean;
}) {
  const embed = getMusicEmbed(data.url, data.size ?? "full");

  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div className="max-w-3xl mx-auto">
        {embed ? (
          <div
            className="w-full overflow-hidden"
            style={{
              borderRadius: "var(--st-border-radius, 2px)",
              border: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
            }}
          >
            <iframe
              src={embed.src}
              title={embed.title}
              width="100%"
              height={embed.height}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ border: "none", display: "block" }}
            />
          </div>
        ) : (
          <div
            className="w-full flex flex-col items-center justify-center gap-4 py-16"
            style={{
              backgroundColor: "var(--st-color-surface, #1A1712)",
              border: "1px dashed color-mix(in srgb, var(--st-color-accent, #C9A84C) 30%, transparent)",
              borderRadius: "var(--st-border-radius, 2px)",
              minHeight: "200px",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ color: "var(--st-color-text-muted, #8A8070)" }}
              aria-hidden="true"
            >
              <circle cx="9" cy="18" r="3" />
              <circle cx="18" cy="15" r="3" />
              <polyline points="12 18 12 8 21 5" />
              <line x1="9" y1="15" x2="9" y2="9" />
            </svg>
            <p className="text-sm" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
              {data.url
                ? "Unsupported URL — try Spotify, SoundCloud, or Apple Music"
                : "Paste a music URL in settings"}
            </p>
          </div>
        )}

        {data.caption && (
          <p
            className="text-center text-sm mt-4"
            style={{ color: "var(--st-color-text-muted, #8A8070)" }}
          >
            {data.caption}
          </p>
        )}
      </div>
    </section>
  );
}
