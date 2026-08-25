"use client";

import { createClient } from "@/lib/supabase/client";

export const MAX_GATED_FILE_BYTES = 20 * 1024 * 1024; // matches the gated-files bucket's file size limit

/** Uploads a PDF as-is (no downscaling — that's image-only, see upload-image.ts)
 * to a private storage bucket and returns the storage path (never a public
 * URL — the bucket has no public read; downloads only happen via a signed
 * URL generated server-side after a visitor unlocks the gate). */
export async function uploadGatedFile(file: File, bucket: string, folder = ""): Promise<{ path: string; fileName: string }> {
  if (file.type !== "application/pdf") throw new Error("Please select a PDF file.");
  if (file.size > MAX_GATED_FILE_BYTES) throw new Error("File must be under 20MB.");

  const supabase = createClient();
  const path = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.pdf`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);

  return { path, fileName: file.name };
}
