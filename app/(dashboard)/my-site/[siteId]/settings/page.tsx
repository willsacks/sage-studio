import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { getCollaboratorsForSite } from "@/lib/queries/site-collaborators";
import { SiteSettingsForm } from "@/components/site/SiteSettingsForm";
import { CustomDomainForm } from "@/components/site/CustomDomainForm";
import { DeleteSiteButton } from "@/components/site/DeleteSiteButton";
import { CollaboratorsPanel } from "@/components/site/CollaboratorsPanel";
import { isProPlan } from "@/lib/plan-gates";
import { getSiteRole, hasAtLeast } from "@/lib/access/site-access";

export const metadata: Metadata = { title: "Site Settings" };

export default async function SiteSettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const site = await getSiteById(siteId);
  if (!site) notFound();
  const role = await getSiteRole(supabase, siteId, user.id);
  if (!hasAtLeast(role, "manager")) notFound();

  const { data: profile } = await supabase.from("profiles").select("tier_key, role").eq("id", site.user_id).single();
  const isPro = isProPlan(profile?.tier_key ?? "", profile?.role);
  const collaborators = await getCollaboratorsForSite(siteId);

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
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Custom Domain</h2>
          {!isPro && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">Pro</span>
          )}
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Serve this site from your own domain (e.g. <code className="text-[var(--foreground)]">yourname.com</code>).
        </p>
        {isPro ? (
          <CustomDomainForm
            siteId={siteId}
            currentDomain={site.custom_domain}
            isVerified={site.custom_domain_verified}
          />
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">Custom domains are available on the Pro plan.</p>
            <a href="/billing" className="mt-2 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
              Upgrade to Pro →
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] pt-6">
        <CollaboratorsPanel siteId={siteId} collaborators={collaborators} />
      </div>

      {role === "owner" && (
        <div className="border-t border-[var(--border)] pt-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete this site</p>
            <p className="text-xs text-[var(--muted-foreground)]">Permanently removes the site and all its pages.</p>
          </div>
          <DeleteSiteButton siteId={siteId} siteName={site.name} />
        </div>
      )}
    </div>
  );
}
