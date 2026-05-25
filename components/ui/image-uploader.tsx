"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  aspectRatio?: "video" | "wide" | "square";
  className?: string;
}

const MAX_DIMENSION = 2000;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB input limit

async function downscaleImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(file);
        return;
      }

      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.88
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
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
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image must be under 20MB.");
      return;
    }
    setError(null);
    setUploading(true);

    let blob: Blob;
    try {
      blob = await downscaleImage(file);
    } catch {
      setError("Could not process image. Please try another file.");
      setUploading(false);
      return;
    }

    const supabase = createClient();
    const ext = blob.type === "image/jpeg" ? "jpg" : file.name.split(".").pop() ?? "jpg";
    const path = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { upsert: false, contentType: blob.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
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
