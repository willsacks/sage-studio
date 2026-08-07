"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { uploadImage } from "@/lib/utils/upload-image";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  aspectRatio?: "video" | "wide" | "square";
  className?: string;
}

export function ImageUploader({
  value,
  onChange,
  bucket = "announcement-images",
  folder = "",
  aspectRatio = "video",
  className,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClass = {
    video: "aspect-video",
    wide: "aspect-[3/1]",
    square: "aspect-square",
  }[aspectRatio];

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file, bucket, folder);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden",
          aspectClass,
          dragging
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : value
            ? "border-transparent"
            : "border-[var(--border)] hover:border-[var(--primary)]/50 bg-[var(--muted)]/30",
          uploading && "pointer-events-none"
        )}
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {value ? (
          <>
            <img src={value} alt="Upload preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors group flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="px-3 py-1.5 rounded-full bg-white/90 text-black text-xs font-medium hover:bg-white"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1.5 rounded-full bg-white/90 text-black hover:bg-white"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)]">Processing & uploading…</p>
              </>
            ) : (
              <>
                <ImagePlus size={28} className="text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  <span className="text-[var(--primary)] font-medium">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">PNG, JPG, WebP up to 20MB · auto-resized</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-[var(--destructive)]">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
