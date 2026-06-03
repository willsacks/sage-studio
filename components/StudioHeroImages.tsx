"use client";

import { useState, useEffect } from "react";
import { STUDIO_HERO_IMAGES } from "@/lib/studio-hero-images";

const INTERVAL_MS = 4500;
const TRANSITION_MS = 1000;

export function StudioHeroImages() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (STUDIO_HERO_IMAGES.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % STUDIO_HERO_IMAGES.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (STUDIO_HERO_IMAGES.length === 0) {
    return (
      <div className="w-full aspect-[4/5] rounded-2xl bg-[var(--accent)]" />
    );
  }

  return (
    <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden">
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
      {/* Subtle gradient overlay at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}
