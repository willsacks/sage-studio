/**
 * Finds every base64-embedded image (data:image/...;base64,...) inside
 * html_content on the known-affected HTML-type site_pages, uploads each
 * decoded image to Supabase Storage (bucket "offering-media", folder
 * "html-editor/migrated"), and rewrites html_content to reference the
 * resulting public URL instead of the inline data URI.
 *
 * This fixes page weight (base64 inflates size ~33% and can never be
 * browser-cached since it's embedded in a document refetched on every
 * visit) without touching the visual crop/positioning of any image — only
 * the `url("data:...")` / `src="data:..."` token is swapped in place.
 *
 * Run: cd sage-studio && npx tsx scripts/migrate-base64-images-to-storage.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET = "offering-media";
const FOLDER = "html-editor/migrated";

// slug is just for logging; id is the actual key.
const PAGES: { slug: string; id: string }[] = [
  { slug: "rooted-river/home", id: "d48487da-7987-4746-b302-28a2ed31bf43" },
  { slug: "rooted-river/connect", id: "b5cc71f3-9695-44e7-9562-a7978a936a98" },
  { slug: "rooted-river/music", id: "55c94675-3fef-48dd-9bf5-953ae8c9c9b9" },
  { slug: "rooted-river/our-way", id: "a139c622-b65e-4695-91dc-0a112b792e98" },
  { slug: "rooted-river/events", id: "2145b8a3-702e-4b3a-930d-74c337a26eed" },
  { slug: "leslie-murphy/home", id: "0524e4b0-72d4-4d22-81fc-a7bb508a605d" },
  { slug: "leslie-murphy/adorn", id: "c69df5b7-61d1-4746-8c6e-47ceed90f4d7" },
];

const DATA_URI_RE = /data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g;

const EXT_BY_MIME: Record<string, string> = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  svg: "svg",
  "svg+xml": "svg",
};

async function migratePage(pageId: string, label: string) {
  const { data: page, error } = await supabase
    .from("site_pages")
    .select("html_content")
    .eq("id", pageId)
    .single();
  if (error || !page) throw error ?? new Error(`${label}: page not found`);

  let html: string = page.html_content ?? "";
  const beforeLen = html.length;

  const matches = [...html.matchAll(DATA_URI_RE)];
  if (matches.length === 0) {
    console.log(`${label}: no base64 images found, skipping.`);
    return;
  }

  // Dedupe identical data URIs (same image reused more than once on a page)
  // so we don't upload the same bytes twice.
  const uniqueUris = [...new Set(matches.map((m) => m[0]))];
  const urlByDataUri = new Map<string, string>();

  for (const dataUri of uniqueUris) {
    const m = DATA_URI_RE.exec(dataUri) ?? dataUri.match(/data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/);
    DATA_URI_RE.lastIndex = 0;
    if (!m) continue;
    const mime = m[1].toLowerCase();
    const base64Data = m[2];
    const ext = EXT_BY_MIME[mime] ?? "jpg";
    const buf = Buffer.from(base64Data, "base64");
    const path = `${FOLDER}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { upsert: false, contentType: `image/${mime === "jpg" ? "jpeg" : mime}` });
    if (uploadError) throw new Error(`${label}: upload failed for ${path}: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urlByDataUri.set(dataUri, publicUrlData.publicUrl);
    console.log(`${label}: uploaded ${(buf.length / 1024).toFixed(0)}KB -> ${publicUrlData.publicUrl}`);
  }

  for (const [dataUri, url] of urlByDataUri) {
    html = html.split(dataUri).join(url);
  }

  const afterLen = html.length;
  const { error: updateError } = await supabase
    .from("site_pages")
    .update({ html_content: html, updated_at: new Date().toISOString() })
    .eq("id", pageId);
  if (updateError) throw updateError;

  console.log(
    `${label}: ${uniqueUris.length} image(s) migrated, ${(beforeLen / 1024).toFixed(0)}KB -> ${(afterLen / 1024).toFixed(0)}KB (${(100 - (afterLen / beforeLen) * 100).toFixed(1)}% smaller)`
  );
}

async function main() {
  for (const { slug, id } of PAGES) {
    await migratePage(id, slug);
  }
  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
