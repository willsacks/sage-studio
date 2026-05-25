import Link from "next/link";
import type { SitePage, ArtistSite } from "@/lib/queries/sites";
import type { StyleTokens } from "@/lib/styles";

export function SiteNav({
  siteSlug,
  pages,
  currentSlug,
  site,
  tokens,
  basePath,
}: {
  siteSlug: string;
  pages: SitePage[];
  currentSlug: string;
  site: ArtistSite;
  tokens: StyleTokens;
  basePath: string;
}) {
  return (
    <nav
      className="sticky top-0 z-40 border-b"
      style={{ backgroundColor: tokens.colorBackground, borderColor: `${tokens.colorText}15` }}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo / site name */}
        <Link href={basePath || "/"} className="flex items-center gap-3 flex-shrink-0">
          {site.logo_url ? (
            <img src={site.logo_url} alt={site.site_title ?? site.name} className="h-8 w-auto object-contain" />
          ) : (
            <span
              className="font-semibold text-lg"
              style={{ fontFamily: `"${tokens.fontDisplay}", serif`, color: tokens.colorText }}
            >
              {site.site_title ?? site.name}
            </span>
          )}
        </Link>

        {/* Nav links — filtered to pages with show_in_nav !== false */}
        {pages.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {pages.filter((p) => p.show_in_nav !== false).map((page) => {
              const isActive = page.slug === currentSlug;
              return (
                <Link
                  key={page.id}
                  href={`${basePath}/${page.slug}`}
                  className="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all"
                  style={{
                    color: isActive ? tokens.colorAccent : tokens.colorText,
                    backgroundColor: isActive ? `${tokens.colorAccent}18` : "transparent",
                    opacity: isActive ? 1 : 0.75,
                  }}
                >
                  {page.title}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
