import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { SiteStyleEditor } from "@/components/site/SiteStyleEditor";
import { DEFAULT_STYLE_KEY } from "@/lib/styles";

export const metadata: Metadata = { title: "Site Style" };

export default async function SiteStylePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const site = await getSiteById(siteId);
  if (!site || site.user_id !== user.id) notFound();

  const currentStyleKey = site.style_key ?? DEFAULT_STYLE_KEY;
  const currentFontScale = site.font_scale ?? 1;

  return (
    <div className="space-y-6">
      <Link
        href={`/my-site/${siteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={14} /> Back to {site.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Design Aesthetic</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Choose the visual style for <strong>{site.name}</strong>. Changes apply immediately to new visitors.
        </p>
      </div>
      <SiteStyleEditor siteId={siteId} currentStyleKey={currentStyleKey} currentFontScale={currentFontScale} />
    </div>
  );
}
