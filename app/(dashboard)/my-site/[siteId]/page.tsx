import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, getPagesForSite } from "@/lib/queries/sites";
import { toggleSitePublished, togglePagePublished, updatePageVisibility } from "@/lib/actions/sites";
import { ArrowLeft, Globe, Pencil, ExternalLink, Settings, Eye, EyeOff, Palette, Home, Navigation, PanelTop } from "lucide-react";
import { format } from "date-fns";
import { PageTypePicker } from "@/components/site/PageTypePicker";
import { SetHomePageButton } from "@/components/site/SetHomePageButton";
import { DeletePageDialog } from "@/components/site/DeletePageDialog";

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }): Promise<Metadata> {
  const { siteId } = await params;
  const site = await getSiteById(siteId);
  return { title: site ? `${site.name} — Pages` : "Site" };
}


export default async function SitePageManagerPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const platformTemplates: never[] = [];
  const personalTemplates: never[] = [];

  const [site, pages] = await Promise.all([
    getSiteById(siteId),
    getPagesForSite(siteId),
  ]);
  if (!site || site.user_id !== user.id) notFound();

  const homePageId = site.home_page_id ?? pages.find((p) => p.page_type === "home")?.id ?? pages[0]?.id;

  const hasCustomDomain = !!(site.custom_domain && site.custom_domain_verified);
  const siteUrl = hasCustomDomain
    ? `https://${site.custom_domain}`
    : `/sites/${site.slug}`;
  const displayUrl = hasCustomDomain
    ? site.custom_domain!
    : `sagestudio.org/sites/${site.slug}`;
  const copyUrl = hasCustomDomain
    ? `https://${site.custom_domain}`
    : `https://www.sagestudio.org/sites/${site.slug}`;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link
          href="/my-site"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={14} /> All Websites
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {site.logo_url && <img src={site.logo_url} alt="" className="h-7 w-7 object-contain" />}
            {site.name}
          </h1>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-sm text-[var(--muted-foreground)]">
              {displayUrl}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {site.is_published && (
            <Link
              href={siteUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
            >
              <ExternalLink size={13} /> View
            </Link>
          )}
          <Link
            href={`/my-site/${siteId}/style`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
          >
            <Palette size={13} /> Style
          </Link>
          <Link
            href={`/my-site/${siteId}/settings`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
          >
            <Settings size={13} /> Settings
          </Link>
          <form action={async () => {
            "use server";
            await toggleSitePublished(siteId, !site.is_published);
          }}>
            <button
              type="submit"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                site.is_published
                  ? "border border-[var(--border)] hover:bg-[var(--accent)]"
                  : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
              }`}
            >
              {site.is_published
                ? <><EyeOff size={13} /> Unpublish</>
                : <><Eye size={13} /> Publish</>
              }
            </button>
          </form>
        </div>
      </div>

      {/* Pages section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--foreground)]">Pages</h2>
          <PageTypePicker siteId={siteId} existingTypes={pages.map((p) => p.page_type as "home" | "about" | "work" | "contact" | "custom")} templates={{ platform: platformTemplates, personal: personalTemplates }} />
        </div>

        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed border-[var(--border)] rounded-xl">
            <Globe size={32} className="text-[var(--muted-foreground)] opacity-30" />
            <div className="text-center">
              <p className="font-medium text-[var(--foreground)]">No pages yet</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Add your first page to get started.</p>
            </div>
            <PageTypePicker siteId={siteId} existingTypes={[]} />
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((page) => (
              <div
                key={page.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[var(--muted-foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono">
                      /{page.slug}
                    </span>
                    <p className="font-medium text-[var(--foreground)] truncate">{page.title}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      page.status === "published"
                        ? "bg-green-100 text-green-700"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}>
                      {page.status}
                    </span>
                    {page.id === homePageId && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--primary)] border border-[var(--primary)]/40 px-1.5 py-0.5 rounded-full">
                        <Home size={9} /> Home
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Updated {format(new Date(page.updated_at), "MMM d")}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {page.status === "published" ? (
                    <>
                      <Link
                        href={`${siteUrl}/${page.slug}`}
                        target="_blank"
                        className="flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
                      >
                        <ExternalLink size={13} />
                      </Link>
                      <form action={async () => { "use server"; await togglePagePublished(page.id, siteId, false); }}>
                        <button type="submit" className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors">
                          <EyeOff size={12} /> Unpublish
                        </button>
                      </form>
                    </>
                  ) : (
                    <form action={async () => { "use server"; await togglePagePublished(page.id, siteId, true); }}>
                      <button type="submit" className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors">
                        <Eye size={12} /> Publish
                      </button>
                    </form>
                  )}
                  {page.id !== homePageId && (
                    <SetHomePageButton siteId={siteId} pageId={page.id} />
                  )}
                  {/* Nav visibility toggle */}
                  <form action={async () => {
                    "use server";
                    await updatePageVisibility(page.id, siteId, { show_in_nav: page.show_in_nav === false });
                  }}>
                    <button
                      type="submit"
                      title={page.show_in_nav === false ? "Hidden from nav — click to show" : "Shown in nav — click to hide"}
                      className={`flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] transition-colors ${page.show_in_nav === false ? "text-[var(--muted-foreground)] opacity-40" : "text-[var(--foreground)]"}`}
                    >
                      <Navigation size={13} />
                    </button>
                  </form>
                  {/* Header visibility toggle */}
                  <form action={async () => {
                    "use server";
                    await updatePageVisibility(page.id, siteId, { hide_header: !page.hide_header });
                  }}>
                    <button
                      type="submit"
                      title={page.hide_header ? "Header hidden — click to show" : "Header visible — click to hide"}
                      className={`flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--accent)] transition-colors ${page.hide_header ? "text-[var(--muted-foreground)] opacity-40" : "text-[var(--foreground)]"}`}
                    >
                      <PanelTop size={13} />
                    </button>
                  </form>
                  <Link
                    href={`/my-site/${siteId}/pages/${page.id}/edit`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors"
                  >
                    <Pencil size={13} /> Edit
                  </Link>
                  <DeletePageDialog pageId={page.id} siteId={siteId} pageTitle={page.title} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
