"use client";

import { useState, useEffect } from "react";
import { STUDIO_HERO_IMAGES } from "@/lib/studio-hero-images";

const INTERVAL_MS = 5000;
const TRANSITION_MS = 1200;

export function StudioHeroImages() {
  const [current, setCurrent] = useState(() =>
    STUDIO_HERO_IMAGES.length > 1
      ? Math.floor(Math.random() * STUDIO_HERO_IMAGES.length)
      : 0
  );

  useEffect(() => {
    if (STUDIO_HERO_IMAGES.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % STUDIO_HERO_IMAGES.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0">
      {STUDIO_HERO_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: i === current ? 1 : 0,
            transition: `opacity ${TRANSITION_MS}ms ease-in-out`,
          }}
        />
      ))}
      {STUDIO_HERO_IMAGES.length === 0 && (
        <div className="absolute inset-0 bg-[var(--primary)]/20" />
      )}
    </div>
  );
}
