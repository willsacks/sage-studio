"use client";

import { useRef, useState } from "react";
import { FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { uploadGatedFile } from "@/lib/utils/upload-file";

interface PdfUploaderProps {
  path: string | null;
  fileName: string | null;
  onChange: (path: string | null, fileName: string | null) => void;
  bucket?: string;
  folder?: string;
  className?: string;
}

export function PdfUploader({
  path,
  fileName,
  onChange,
  bucket = "gated-files",
  folder = "",
  className,
}: PdfUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const result = await uploadGatedFile(file, bucket, folder);
      onChange(result.path, result.fileName);
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
    onChange(null, null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer p-4",
          dragging
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : "border-[var(--border)] hover:border-[var(--primary)]/50 bg-[var(--muted)]/30",
          uploading && "pointer-events-none"
        )}
        onClick={() => !path && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {path ? (
          <div className="flex items-center gap-3">
            <FileText size={22} className="text-[var(--primary)] flex-shrink-0" />
            <span className="text-sm truncate flex-1 text-[var(--foreground)]">{fileName ?? "Uploaded file"}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="text-xs font-medium text-[var(--primary)] flex-shrink-0"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 rounded-full hover:bg-[var(--muted)] flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            {uploading ? (
              <>
                <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)]">Uploading…</p>
              </>
            ) : (
              <>
                <FileText size={24} className="text-[var(--muted-foreground)]" />
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  <span className="text-[var(--primary)] font-medium">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">PDF up to 20MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-[var(--destructive)]">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
