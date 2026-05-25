import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { SiteSettingsForm } from "@/components/site/SiteSettingsForm";
import { CustomDomainForm } from "@/components/site/CustomDomainForm";
import { DeleteSiteButton } from "@/components/site/DeleteSiteButton";

export const metadata: Metadata = { title: "Site Settings" };

export default async function SiteSettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const site = await getSiteById(siteId);
  if (!site || site.user_id !== user.id) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/my-site/${siteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={14} /> Back to {site.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Configure {site.name}.</p>
      </div>
      <SiteSettingsForm siteId={siteId} site={site} />

      <div className="border-t border-[var(--border)] pt-6 space-y-2">
        <h2 className="text-lg font-semibold">Custom Domain</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Serve this site from your own domain (e.g. <code className="text-[var(--foreground)]">yourname.com</code>).
        </p>
        <CustomDomainForm
          siteId={siteId}
          currentDomain={site.custom_domain}
          isVerified={site.custom_domain_verified}
        />
      </div>

      <div className="border-t border-[var(--border)] pt-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Delete this site</p>
          <p className="text-xs text-[var(--muted-foreground)]">Permanently removes the site and all its pages.</p>
        </div>
        <DeleteSiteButton siteId={siteId} siteName={site.name} />
      </div>
    </div>
  );
}
