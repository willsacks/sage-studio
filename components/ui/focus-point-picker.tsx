"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

interface FocusPointPickerProps {
  imageUrl: string;
  focusX: number; // 0-100
  focusY: number; // 0-100
  onChange: (x: number, y: number) => void;
  aspectRatio?: "wide" | "video" | "square";
  className?: string;
}

export function FocusPointPicker({
  imageUrl,
  focusX,
  focusY,
  onChange,
  aspectRatio = "wide",
  className,
}: FocusPointPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const aspectClass = {
    wide: "aspect-[3/1]",
    video: "aspect-video",
    square: "aspect-square",
  }[aspectRatio];

  const getPosition = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    return { x, y };
  }, []);

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const pos = getPosition(e.clientX, e.clientY);
    if (pos) onChange(pos.x, pos.y);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging) return;
    const pos = getPosition(e.clientX, e.clientY);
    if (pos) onChange(pos.x, pos.y);
  }

  function handlePointerUp() {
    setIsDragging(false);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full rounded-lg overflow-hidden cursor-crosshair select-none",
          aspectClass,
          isDragging && "ring-2 ring-[var(--primary)]"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />

        {/* Crosshair lines */}
        <div
          className="absolute inset-y-0 w-px bg-white/60 pointer-events-none"
          style={{ left: `${focusX}%`, transform: "translateX(-50%)" }}
        />
        <div
          className="absolute inset-x-0 h-px bg-white/60 pointer-events-none"
          style={{ top: `${focusY}%`, transform: "translateY(-50%)" }}
        />

        {/* Focus dot */}
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white bg-[var(--primary)]/80 shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform"
          style={{ left: `${focusX}%`, top: `${focusY}%`, transform: `translate(-50%, -50%) scale(${isDragging ? 1.3 : 1})` }}
        />

        {/* Dark vignette to make controls more visible */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.25) 100%)"
        }} />
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Click or drag to set focus point — the most important part of the image.
      </p>
    </div>
  );
}
