/**
 * Reusable "Import from WordPress" module — pulls pages/posts from any public
 * WordPress site's REST API (no auth, no export/upload step needed) and turns
 * them into site_pages/site_posts rows using the same "imported HTML" model
 * already used by ImportHtmlButton.tsx (page_type "html", rendered in the
 * existing sandboxed iframe — no new trust model). Images referenced in the
 * content are downloaded and re-uploaded to Supabase Storage so the imported
 * site never depends on the old WordPress host staying online.
 */
import { lookup } from "node:dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db";

const MAX_ITEMS_PER_TYPE = 100;
const MAX_IMAGES_PER_ITEM = 30;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export interface WordPressPreviewItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
}

export interface WordPressPreview {
  siteName: string | null;
  pages: WordPressPreviewItem[];
  posts: WordPressPreviewItem[];
}

export class WordPressImportError extends Error {}

/** Accepts "fulcrumventures.io", "www.fulcrumventures.io", or a full URL and
 * returns a normalized origin, e.g. "https://fulcrumventures.io". */
export function normalizeWordPressUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new WordPressImportError("Please enter a site URL.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new WordPressImportError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WordPressImportError("Only http(s) URLs are supported.");
  }
  return `${url.protocol}//${url.host}`;
}

const PRIVATE_IPV4_RANGES: [number, number][] = [
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")],
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  [ipToInt("100.64.0.0"), ipToInt("100.127.255.255")], // CGNAT
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")], // link-local / cloud metadata
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  [ipToInt("192.0.0.0"), ipToInt("192.0.0.255")],
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
  [ipToInt("198.18.0.0"), ipToInt("198.19.255.255")],
];

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
}

/** Blocks fetches to loopback/private/link-local/cloud-metadata addresses —
 * this feature lets a logged-in user tell our server to fetch an arbitrary
 * hostname, which is a classic SSRF vector otherwise. Only checks the
 * initial hostname's resolved address, not every hop of a redirect chain;
 * acceptable here since the target is expected to be the user's own public
 * WordPress site, not an arbitrary attacker-controlled URL. */
async function assertPublicHostname(urlString: string): Promise<void> {
  const { hostname } = new URL(urlString);
  if (hostname === "localhost") throw new WordPressImportError("That host isn't reachable.");
  let address: string;
  try {
    const result = await lookup(hostname);
    address = result.address;
  } catch {
    throw new WordPressImportError("Could not resolve that hostname.");
  }
  const blocked = address.includes(":") ? isPrivateIpv6(address) : isPrivateIpv4(address);
  if (blocked) throw new WordPressImportError("That host isn't reachable.");
}

async function fetchJson(url: string): Promise<{ json: unknown; totalPages: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new WordPressImportError(`Request failed (${res.status})`);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1") || 1;
    return { json: await res.json(), totalPages };
  } catch (err) {
    if (err instanceof WordPressImportError) throw err;
    throw new WordPressImportError("Could not reach that site — check the URL and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WpRestItem = any;

function toPreviewItem(item: WpRestItem): WordPressPreviewItem {
  return {
    id: item.id,
    title: decodeEntities(item.title?.rendered ?? "(untitled)"),
    slug: item.slug ?? String(item.id),
    excerpt: decodeEntities(stripHtml(item.excerpt?.rendered ?? "")).slice(0, 160),
  };
}

/** Step 1 of the wizard: list what's importable without writing anything. */
export async function fetchWordPressPreview(siteUrl: string): Promise<WordPressPreview> {
  const origin = normalizeWordPressUrl(siteUrl);
  await assertPublicHostname(origin);

  let siteName: string | null = null;
  try {
    const { json } = await fetchJson(`${origin}/wp-json`);
    siteName = typeof (json as WpRestItem)?.name === "string" ? (json as WpRestItem).name : null;
  } catch {
    // Non-fatal — some sites hide the index route. Fall through and let the
    // pages/posts fetches below surface a real error if the site isn't WP at all.
  }

  const [{ json: pagesJson }, { json: postsJson }] = await Promise.all([
    fetchJson(`${origin}/wp-json/wp/v2/pages?per_page=${MAX_ITEMS_PER_TYPE}&status=publish&_fields=id,title,slug,excerpt`),
    fetchJson(`${origin}/wp-json/wp/v2/posts?per_page=${MAX_ITEMS_PER_TYPE}&status=publish&_fields=id,title,slug,excerpt`),
  ]);

  return {
    siteName,
    pages: (pagesJson as WpRestItem[]).map(toPreviewItem),
    posts: (postsJson as WpRestItem[]).map(toPreviewItem),
  };
}

function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const src = match[1];
    if (/^https?:\/\//i.test(src)) urls.add(src);
    if (urls.size >= MAX_IMAGES_PER_ITEM) break;
  }
  return [...urls];
}

async function downloadAndReuploadImage(
  imageUrl: string,
  admin: SupabaseClient<Database>,
  folder: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;

    const ext = (contentType.split("/")[1] ?? "jpg").split(";")[0];
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from("offering-media")
      .upload(path, buffer, { contentType, upsert: false });
    if (error) return null;
    const { data } = admin.storage.from("offering-media").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Downloads every <img src> referenced in `html` and rewrites the tag to
 * point at the newly-uploaded Sage Studio copy. Images that fail to download
 * (dead links, oversized, non-image content-type) are left pointing at the
 * original WordPress URL rather than failing the whole import. */
async function rewriteImages(
  html: string,
  admin: SupabaseClient<Database>,
  folder: string
): Promise<{ html: string; warnings: string[] }> {
  const urls = extractImageUrls(html);
  const warnings: string[] = [];
  let result = html;
  for (const url of urls) {
    const newUrl = await downloadAndReuploadImage(url, admin, folder);
    if (newUrl) {
      result = result.split(url).join(newUrl);
    } else {
      warnings.push(`Could not re-host image: ${url}`);
    }
  }
  return { html: result, warnings };
}

function uniqueSlug(base: string, existing: Set<string>): string {
  let slug = base || "page";
  if (!existing.has(slug)) return slug;
  let n = 2;
  while (existing.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

export interface ImportSelection {
  pageIds: number[];
  postIds: number[];
}

export interface ImportResult {
  pagesImported: number;
  postsImported: number;
  warnings: string[];
}

/** Step 2 of the wizard: fetch the full content for the selected items,
 * re-host their images, and insert them as draft pages/posts. */
export async function importWordPressContent(
  siteUrl: string,
  siteId: string,
  userId: string,
  admin: SupabaseClient<Database>,
  selection: ImportSelection
): Promise<ImportResult> {
  const origin = normalizeWordPressUrl(siteUrl);
  await assertPublicHostname(origin);
  const folder = `wordpress-import/${siteId}`;
  const warnings: string[] = [];

  const [{ data: existingPages }, { data: existingPosts }] = await Promise.all([
    admin.from("site_pages").select("slug").eq("site_id", siteId),
    admin.from("site_posts").select("slug").eq("site_id", siteId),
  ]);
  const pageSlugs = new Set((existingPages ?? []).map((p) => p.slug));
  const postSlugs = new Set((existingPosts ?? []).map((p) => p.slug));

  let pagesImported = 0;
  for (const id of selection.pageIds.slice(0, MAX_ITEMS_PER_TYPE)) {
    try {
      const { json } = await fetchJson(`${origin}/wp-json/wp/v2/pages/${id}`);
      const item = json as WpRestItem;
      const rawHtml = item.content?.rendered ?? "";
      const { html, warnings: imgWarnings } = await rewriteImages(rawHtml, admin, folder);
      warnings.push(...imgWarnings);

      const title = decodeEntities(item.title?.rendered ?? "Imported Page");
      const slug = uniqueSlug(item.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), pageSlugs);
      pageSlugs.add(slug);

      const { data: countResult } = await admin
        .from("site_pages")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId);

      const { error } = await admin.from("site_pages").insert({
        user_id: userId,
        site_id: siteId,
        title,
        slug,
        page_type: "html",
        page_data: [] as unknown as Json,
        html_content: html,
        status: "draft",
        sort_order: (countResult as unknown as number) ?? 99,
      });
      if (error) { warnings.push(`Skipped page "${title}": ${error.message}`); continue; }
      pagesImported++;
    } catch (err) {
      warnings.push(`Skipped page #${id}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  let postsImported = 0;
  for (const id of selection.postIds.slice(0, MAX_ITEMS_PER_TYPE)) {
    try {
      const { json } = await fetchJson(`${origin}/wp-json/wp/v2/posts/${id}`);
      const item = json as WpRestItem;
      const rawHtml = item.content?.rendered ?? "";
      const { html, warnings: imgWarnings } = await rewriteImages(rawHtml, admin, folder);
      warnings.push(...imgWarnings);

      const title = decodeEntities(item.title?.rendered ?? "Imported Post");
      const slug = uniqueSlug(item.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), postSlugs);
      postSlugs.add(slug);
      const excerpt = decodeEntities(stripHtml(item.excerpt?.rendered ?? "")).slice(0, 300);

      const { error } = await admin.from("site_posts").insert({
        user_id: userId,
        site_id: siteId,
        title,
        slug,
        excerpt: excerpt || null,
        html_content: html,
        status: "draft",
      });
      if (error) { warnings.push(`Skipped post "${title}": ${error.message}`); continue; }
      postsImported++;
    } catch (err) {
      warnings.push(`Skipped post #${id}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return { pagesImported, postsImported, warnings };
}
