"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/ui/image-uploader";
import { updateSite } from "@/lib/actions/sites";
import type { ArtistSite } from "@/lib/queries/sites";

export function SiteSettingsForm({ siteId, site }: { siteId: string; site: ArtistSite }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState<string | null>(site.logo_url);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    formData.set("logo_url", logoUrl ?? "");

    startTransition(async () => {
      const result = await updateSite(siteId, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
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
        <Textarea id="footer_text" name="footer_text" defaultValue={site.footer_text ?? ""} placeholder={`© ${new Date().getFullYear()} ${site.name}`} rows={2} />
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
