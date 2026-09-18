"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Video, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createCourseVideoUploadUrl, getCourseVideoPreviewUrl } from "@/lib/actions/courses";
import { MAX_COURSE_VIDEO_BYTES } from "@/lib/constants/course-video";

interface CourseVideoUploaderProps {
  courseId: string;
  value: string | null; // storage path, not a URL — private bucket
  onChange: (path: string | null) => void;
  className?: string;
}

/** Adapted from components/ui/video-uploader.tsx for the private
 * course-videos bucket: instead of uploading straight to a public bucket
 * and storing the public URL, this mints a signed upload URL server-side
 * (ownership-checked) and uploads to that — see createCourseVideoUploadUrl
 * for why. Playback preview likewise needs a fresh signed URL each time
 * since there's no public URL to fall back on. */
export function CourseVideoUploader({ courseId, value, onChange, className }: CourseVideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) { setPreviewUrl(null); return; }
    getCourseVideoPreviewUrl(courseId, value).then((res) => {
      if (!cancelled && "url" in res) setPreviewUrl(res.url ?? null);
    });
    return () => { cancelled = true; };
  }, [courseId, value]);

  async function upload(file: File) {
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file (MP4, WebM, MOV).");
      return;
    }
    if (file.size > MAX_COURSE_VIDEO_BYTES) {
      setError(`Video must be under ${Math.floor(MAX_COURSE_VIDEO_BYTES / (1024 * 1024))}MB.`);
      return;
    }
    setError(null);
    setUploading(true);

    const prepared = await createCourseVideoUploadUrl(courseId, file.name);
    if ("error" in prepared) {
      setError(prepared.error ?? "Could not prepare upload");
      setUploading(false);
      return;
    }

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("course-videos")
      .uploadToSignedUrl(prepared.path!, prepared.token!, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    onChange(prepared.path!);
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
        {value && previewUrl ? (
          <>
            <video src={previewUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" controls />
            <div className="absolute top-2 right-2">
              <button type="button" onClick={handleRemove} className="p-1.5 rounded-full bg-white/90 text-black hover:bg-white">
                <X size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)]">Uploading video…</p>
              </>
            ) : (
              <>
                <Video size={28} className="text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  <span className="text-[var(--primary)] font-medium">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  MP4, WebM, MOV · up to {Math.floor(MAX_COURSE_VIDEO_BYTES / (1024 * 1024))}MB
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-[var(--destructive)]">{error}</p>}

      <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/mov" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
