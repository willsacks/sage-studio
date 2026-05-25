"use client";

import type { VideoEmbedBlockData } from "@/lib/types/builder";

function getEmbedUrl(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (parsed.hostname === "youtu.be") {
      const videoId = parsed.pathname.slice(1);
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (
      parsed.hostname === "vimeo.com" ||
      parsed.hostname === "www.vimeo.com"
    ) {
      const videoId = parsed.pathname.slice(1);
      if (videoId && /^\d+/.test(videoId))
        return `https://player.vimeo.com/video/${videoId}`;
    }

    return null;
  } catch {
    return null;
  }
}

export function VideoEmbedBlock({
  data,
}: {
  data: VideoEmbedBlockData;
  isEditing?: boolean;
}) {
  const embedUrl = getEmbedUrl(data.url);

  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div className="max-w-3xl mx-auto">
        {embedUrl ? (
          <div
            className="relative w-full overflow-hidden"
            style={{
              paddingBottom: "56.25%",
              backgroundColor: "var(--st-color-surface, #1A1712)",
              border: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
              borderRadius: "var(--st-border-radius, 2px)",
            }}
          >
            <iframe
              src={embedUrl}
              title={data.caption ?? "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              style={{ border: "none" }}
            />
          </div>
        ) : (
          <div
            className="w-full flex flex-col items-center justify-center gap-4 py-16"
            style={{
              backgroundColor: "var(--st-color-surface, #1A1712)",
              border: "1px dashed color-mix(in srgb, var(--st-color-accent, #C9A84C) 30%, transparent)",
              borderRadius: "var(--st-border-radius, 2px)",
              minHeight: "240px",
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
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" strokeWidth="0" />
            </svg>
            <p className="text-sm" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
              Invalid or unsupported video URL
            </p>
            {data.url && (
              <p
                className="text-xs font-mono max-w-xs truncate"
                style={{ color: "var(--st-color-text-muted, #8A8070)" }}
              >
                {data.url}
              </p>
            )}
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
