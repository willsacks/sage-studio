import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMySites } from "@/lib/queries/sites";
import { Globe, Plus, Settings, ExternalLink, Palette } from "lucide-react";

export const metadata: Metadata = { title: "My Websites" };

export default async function MySitesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sites = await getMySites();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe size={24} /> My Websites
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Create and manage your public-facing websites. Each site has its own URL and pages.
          </p>
        </div>
        <Link
          href="/my-site/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> New Website
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-20 border-2 border-dashed border-[var(--border)] rounded-xl">
          <Globe size={40} className="text-[var(--muted-foreground)] opacity-30" />
          <div className="text-center">
            <p className="font-semibold text-[var(--foreground)]">No websites yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-xs">
              Create a website for each facet of your artistic practice — music, visual art, teaching, shows.
            </p>
          </div>
          <Link
            href="/my-site/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Create Your First Website
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:border-[var(--primary)]/40 transition-colors"
              >
                {/* Site header */}
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {site.logo_url ? (
                        <img src={site.logo_url} alt="" className="h-6 w-6 object-contain flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                          <Globe size={12} className="text-[var(--primary)]" />
                        </div>
                      )}
                      <h2 className="font-semibold text-[var(--foreground)] truncate">{site.name}</h2>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      site.is_published
                        ? "bg-green-100 text-green-700"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}>
                      {site.is_published ? "Live" : "Draft"}
                    </span>
                  </div>

                  {/* URL */}
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-xs text-[var(--muted-foreground)] truncate">
                      {(site.custom_domain && site.custom_domain_verified)
                        ? site.custom_domain
                        : `sagestudio.org/sites/${site.slug}`}
                    </span>
                  </div>

                  {site.site_tagline && (
                    <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">{site.site_tagline}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-[var(--border)] p-3 flex items-center gap-2">
                  <Link
                    href={`/my-site/${site.id}`}
                    className="flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    Manage
                  </Link>
                  <Link
                    href={`/my-site/${site.id}/style`}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                    title="Design style"
                  >
                    <Palette size={13} />
                  </Link>
                  <Link
                    href={`/my-site/${site.id}/settings`}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                    title="Settings"
                  >
                    <Settings size={13} />
                  </Link>
                  {site.is_published && (
                    <Link
                      href={`/sites/${site.slug}`}
                      target="_blank"
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                    >
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {/* Add another */}
            <Link
              href="/my-site/new"
              className="rounded-xl border-2 border-dashed border-[var(--border)] bg-transparent hover:border-[var(--primary)]/40 transition-colors flex flex-col items-center justify-center gap-3 p-6 min-h-[160px]"
            >
              <Plus size={20} className="text-[var(--muted-foreground)]" />
              <p className="text-sm font-medium text-[var(--muted-foreground)]">Add another website</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
