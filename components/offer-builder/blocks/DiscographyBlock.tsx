"use client";

import type { DiscographyBlockData } from "@/lib/types/builder";

const RELEASE_TYPE_LABELS: Record<string, string> = {
  album: "Album",
  ep: "EP",
  single: "Single",
  mixtape: "Mixtape",
};

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

export function DiscographyBlock({
  data,
}: {
  data: DiscographyBlockData;
  isEditing?: boolean;
}) {
  const cols = (data.columns ?? 3) as 2 | 3 | 4;

  return (
    <section
      className="w-full px-8 py-16"
      style={{ backgroundColor: "var(--st-color-background, #0E0C09)" }}
    >
      <div className="max-w-5xl mx-auto">
        {(data.heading || data.subheading) && (
          <div className="mb-10 text-center">
            {data.heading && (
              <h2
                className="font-bold"
                style={{
                  color: "var(--st-color-heading, #F5F0E8)",
                  fontFamily: "var(--st-font-display, serif)",
                  fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
                }}
              >
                {data.heading}
              </h2>
            )}
            {data.subheading && (
              <p className="mt-2 text-base" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
                {data.subheading}
              </p>
            )}
          </div>
        )}

        <div className={`grid ${GRID_COLS[cols]} gap-6`}>
          {data.releases.map((release) => {
            const card = (
              <div className="group">
                <div
                  className="w-full aspect-square overflow-hidden mb-3"
                  style={{
                    backgroundColor: "var(--st-color-surface, #1A1712)",
                    borderRadius: "var(--st-border-radius, 2px)",
                    border: "1px solid var(--st-color-border, rgba(201,168,76,0.15))",
                  }}
                >
                  {release.artwork ? (
                    <img
                      src={release.artwork}
                      alt={release.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        width="36"
                        height="36"
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
                  )}
                </div>
                <div>
                  <p
                    className="font-medium text-sm leading-snug group-hover:opacity-80 transition-opacity"
                    style={{
                      color: "var(--st-color-heading, #F5F0E8)",
                      fontFamily: "var(--st-font-display, serif)",
                    }}
                  >
                    {release.title || "Untitled"}
                  </p>
                  {(release.year || release.type) && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--st-color-text-muted, #8A8070)" }}>
                      {[release.year, release.type ? RELEASE_TYPE_LABELS[release.type] : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            );

            return release.url ? (
              <a
                key={release.id}
                href={release.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {card}
              </a>
            ) : (
              <div key={release.id}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
