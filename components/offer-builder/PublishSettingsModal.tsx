"use client";

import { useState } from "react";
import { X, Copy, Check, Globe, ExternalLink, Share2 } from "lucide-react";
import type { OfferPage } from "@/lib/queries/offer-pages";
import { ImageUploader } from "@/components/ui/image-uploader";
import { saveOfferPage, verifyCustomDomain } from "@/lib/actions/offer-pages";
import { useBuilderStore } from "@/lib/store/builder";
import { cn } from "@/lib/utils/cn";

type Tab = "subdirectory" | "subdomain" | "custom_domain";

export function PublishSettingsModal({
  page,
  artistUsername,
  onClose,
  onSlugChange,
  saveSettingsAction,
}: {
  page: OfferPage;
  artistUsername: string | null;
  onClose: () => void;
  onSlugChange?: (slug: string) => void;
  saveSettingsAction?: (id: string, data: { slug: string; publish_mode: string; custom_domain?: string; og_image?: string | null; og_title?: string | null; og_description?: string | null }) => Promise<void>;
}) {
  const pageAny = page as OfferPage & { og_image?: string | null; og_title?: string | null; og_description?: string | null };
  const [tab, setTab] = useState<Tab>((page.publish_mode as Tab) ?? "subdirectory");
  const [slug, setSlug] = useState(page.slug);
  const [customDomain, setCustomDomain] = useState<string>(page.custom_domain ?? "");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [ogImage, setOgImage] = useState<string | null>(pageAny.og_image ?? null);
  const [ogTitle, setOgTitle] = useState<string>(pageAny.og_title ?? "");
  const [ogDescription, setOgDescription] = useState<string>(pageAny.og_description ?? "");
  const theme = useBuilderStore((s) => s.theme);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org";

  const urls: Record<Tab, string> = {
    subdirectory: `${baseUrl}/artists/${artistUsername ?? "[username]"}/${slug}`,
    subdomain: `https://${artistUsername ?? "[username]"}.sagestudio.org/${slug}`,
    custom_domain: customDomain ? `https://${customDomain}/${slug}` : "Enter your domain below",
  };

  async function handleSave() {
    const ogData = { og_image: ogImage, og_title: ogTitle || null, og_description: ogDescription || null };
    if (saveSettingsAction) {
      await saveSettingsAction(page.id, { slug, publish_mode: tab, custom_domain: customDomain || undefined, ...ogData });
    } else {
      await saveOfferPage(page.id, { slug, publish_mode: tab, custom_domain: customDomain || undefined });
    }
    onSlugChange?.(slug);
    onClose();
  }

  async function handleVerify() {
    if (!customDomain) return;
    setVerifying(true);
    const result = await verifyCustomDomain(page.id, customDomain);
    setVerifyResult(result);
    setVerifying(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(urls[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-[var(--primary)]" />
            <h2 className="font-semibold text-[var(--foreground)]">Publish Settings</h2>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          {(["subdirectory", "subdomain", "custom_domain"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-3 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {t === "subdirectory" ? "Platform URL" : t === "subdomain" ? "Subdomain" : "Custom Domain"}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* URL Preview */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
            <code className="flex-1 text-xs text-[var(--muted-foreground)] truncate">{urls[tab]}</code>
            <button onClick={copyUrl} className="text-[var(--muted-foreground)] hover:text-[var(--primary)] flex-shrink-0">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            {page.status === "published" && (
              <a href={urls[tab]} target="_blank" rel="noopener noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {/* Slug editor (shown on subdirectory + subdomain tabs) */}
          {tab !== "custom_domain" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Page Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
          )}

          {/* Subdomain info */}
          {tab === "subdomain" && (
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <p className="text-xs text-[var(--muted-foreground)]">
                Subdomain routing requires wildcard DNS <code className="text-[var(--muted-foreground)]">*.sagestudio.org</code> to be configured with your hosting provider. Contact your platform admin to activate.
              </p>
            </div>
          )}

          {/* Custom domain */}
          {tab === "custom_domain" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Your Domain</label>
                <input
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                  placeholder="yoursite.com"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">DNS Instructions</p>
                <p className="text-xs text-[var(--muted-foreground)]">Add these records at your domain registrar:</p>
                <div className="font-mono text-xs space-y-1 text-[var(--muted-foreground)]">
                  <div className="flex gap-4"><span className="text-[var(--muted-foreground)] w-12">Type</span><span className="text-[var(--muted-foreground)] w-16">Name</span><span>Value</span></div>
                  <div className="flex gap-4"><span className="w-12">A</span><span className="w-16">@</span><span className="text-[var(--primary)]">76.76.21.21</span></div>
                  <div className="flex gap-4"><span className="w-12">CNAME</span><span className="w-16">www</span><span className="text-[var(--primary)]">cname.vercel-dns.com</span></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVerify}
                  disabled={!customDomain || verifying}
                  className="flex-1 py-2 rounded-md text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {verifying ? "Checking..." : "Verify Domain"}
                </button>
                {verifyResult && (
                  <span className={cn("text-xs font-medium", verifyResult.verified ? "text-green-400" : "text-red-400")}>
                    {verifyResult.verified ? "✓ Verified" : "✗ Not verified"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Social sharing */}
          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Share2 size={14} className="text-[var(--muted-foreground)]" />
              <p className="text-xs font-medium text-[var(--muted-foreground)]">Social Sharing Preview</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--muted-foreground)]">Share image · Recommended 1200 × 630 px</p>
              <ImageUploader
                bucket="offering-media"
                folder="og-images"
                value={ogImage}
                onChange={(url) => setOgImage(url)}
                aspectRatio="video"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Share title</label>
              <input
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder={page.title ?? "Page title"}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">Share description</label>
              <textarea
                value={ogDescription}
                onChange={(e) => setOgDescription(e.target.value)}
                placeholder="What should show in the preview when someone shares this page?"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
              />
            </div>
          </div>

          {/* Theme accent */}
          <div className="border-t border-[var(--border)] pt-4 space-y-2">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Page Accent Color</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={theme.accentColor}
                onChange={(e) => useBuilderStore.getState().updateTheme({ accentColor: e.target.value })}
                className="h-8 w-14 rounded cursor-pointer border border-[var(--border)]"
              />
              <code className="text-xs text-[var(--muted-foreground)]">{theme.accentColor}</code>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
