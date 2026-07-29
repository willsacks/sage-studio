"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ImageUploader } from "@/components/ui/image-uploader";
import { updateSite } from "@/lib/actions/sites";
import type { ArtistSite } from "@/lib/queries/sites";

export function SiteSettingsForm({ siteId, site }: { siteId: string; site: ArtistSite }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState<string | null>(site.logo_url);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(site.favicon_url ?? null);
  const [footerText, setFooterText] = useState(site.footer_text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    formData.set("logo_url", logoUrl ?? "");
    formData.set("favicon_url", faviconUrl ?? "");
    formData.set("footer_text", footerText);

    startTransition(async () => {
      try {
        const result = await updateSite(siteId, formData);
        if (result?.error) {
          setError(result.error);
        } else {
          setSaved(true);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Site Name *</Label>
        <p className="text-xs text-[var(--muted-foreground)]">Internal name to identify this site.</p>
        <Input id="name" name="name" defaultValue={site.name} required />
      </div>

      <div className="space-y-2">
        <Label>Logo</Label>
        <p className="text-xs text-[var(--muted-foreground)]">Appears in the site nav. Leave blank to use the site title as text.</p>
        <ImageUploader bucket="offering-media" folder="site-logos" value={logoUrl} onChange={setLogoUrl} />
      </div>

      <div className="space-y-2">
        <Label>Favicon</Label>
        <p className="text-xs text-[var(--muted-foreground)]">Browser tab icon. Square image, recommended 64×64px or larger.</p>
        <ImageUploader bucket="offering-media" folder="site-favicons" value={faviconUrl} onChange={setFaviconUrl} aspectRatio="square" className="max-w-[96px]" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="site_title">Site Title</Label>
        <p className="text-xs text-[var(--muted-foreground)]">Shown in the browser tab and nav. Defaults to the site name.</p>
        <Input id="site_title" name="site_title" defaultValue={site.site_title ?? ""} placeholder={site.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="site_tagline">Tagline</Label>
        <Input id="site_tagline" name="site_tagline" defaultValue={site.site_tagline ?? ""} placeholder="A short description" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="footer_text">Footer Text</Label>
        <RichTextEditor
          content={footerText}
          onChange={setFooterText}
          placeholder={`© ${new Date().getFullYear()} ${site.name}`}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Settings saved.</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 size={15} className="animate-spin mr-2" /> : null}
          Save Settings
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
