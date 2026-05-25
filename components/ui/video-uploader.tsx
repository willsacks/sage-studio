"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Video, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

interface VideoUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  className?: string;
}

export function VideoUploader({
  value,
  onChange,
  bucket = "offering-media",
  folder = "hero-videos",
  className,
}: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file (MP4, WebM, MOV).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Video must be under 500 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    setProgress(0);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type });

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
          "relative w-full aspect-video rounded-xl border-2 border-dashed transition-colors overflow-hidden",
          dragging
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : value
            ? "border-transparent"
            : "border-[var(--border)] hover:border-[var(--primary)]/50 bg-[var(--muted)]/30 cursor-pointer",
          uploading && "pointer-events-none"
        )}
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {value ? (
          <>
            <video
              src={value}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors group flex items-center justify-center">
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
                <p className="text-sm text-[var(--muted-foreground)]">Uploading video…</p>
                <p className="text-xs text-[var(--muted-foreground)]">Large files may take a moment</p>
              </>
            ) : (
              <>
                <Video size={28} className="text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  <span className="text-[var(--primary)] font-medium">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">MP4, WebM, MOV · up to 500 MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-[var(--destructive)]">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mov"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
