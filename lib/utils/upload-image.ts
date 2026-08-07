"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_DIMENSION = 2000;
export const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024; // 20MB input limit

export async function downscaleImage(file: File): Promise<Blob> {
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

/** Downscales (if needed), uploads to Supabase Storage, and returns the public URL.
 * Shared by components/ui/image-uploader.tsx and the HTML editor's inline
 * "Replace Image" flow (HtmlPageEditor.tsx) — same validation and error
 * messages either way. */
export async function uploadImage(file: File, bucket: string, folder = ""): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error("Image must be under 20MB.");

  let blob: Blob;
  try {
    blob = await downscaleImage(file);
  } catch {
    throw new Error("Could not process image. Please try another file.");
  }

  const supabase = createClient();
  const ext = blob.type === "image/jpeg" ? "jpg" : file.name.split(".").pop() ?? "jpg";
  const path = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: false, contentType: blob.type });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
