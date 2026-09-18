"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { SitePage, ArtistSite } from "@/lib/queries/sites";
import type { StyleTokens } from "@/lib/styles";

export function SiteNav({
  siteSlug,
  pages,
  currentSlug,
  site,
  tokens,
  basePath,
  hasPosts,
  isBlogActive,
  blogLabel,
}: {
  siteSlug: string;
  pages: SitePage[];
  currentSlug: string;
  site: ArtistSite;
  tokens: StyleTokens;
  basePath: string;
  /** Shows a blog nav entry once the site has at least one published post
   * AND the owner hasn't turned it off in Site Settings — no point linking
   * to an empty archive, and some owners want the blog reachable only
   * directly (e.g. shared as a link) without it cluttering the main nav. */
  hasPosts?: boolean;
  isBlogActive?: boolean;
  blogLabel?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navPages = pages.filter((p) => p.show_in_nav !== false);
  const showNav = navPages.length > 0 || hasPosts;

  return (
    <nav
      className="sticky top-0 z-40 border-b"
      style={{ backgroundColor: tokens.colorBackground, borderColor: `${tokens.colorText}15` }}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo / site name */}
        <Link href={basePath || "/"} className="flex items-center gap-3 flex-shrink-0" onClick={() => setMobileOpen(false)}>
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

        {showNav && (
          <>
            {/* Desktop nav links */}
            <div className="hidden sm:flex items-center gap-1 overflow-x-auto">
              {navPages.map((page) => {
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
              {hasPosts && (
                <Link
                  href={`${basePath}/blog`}
                  className="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all"
                  style={{
                    color: isBlogActive ? tokens.colorAccent : tokens.colorText,
                    backgroundColor: isBlogActive ? `${tokens.colorAccent}18` : "transparent",
                    opacity: isBlogActive ? 1 : 0.75,
                  }}
                >
                  {blogLabel ?? "Blog"}
                </Link>
              )}
            </div>

            {/* Mobile hamburger — the old horizontal-scroll-only list gave no
                hint that a page might be cut off past the visible width, the
                same discoverability problem fixed elsewhere in the app's own
                dashboard nav; a real menu is unambiguous at any page count. */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="sm:hidden flex-shrink-0 p-2 -mr-2 rounded-md"
              style={{ color: tokens.colorText }}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </>
        )}
      </div>

      {showNav && mobileOpen && (
        <div
          className="sm:hidden border-t px-6 py-2"
          style={{ borderColor: `${tokens.colorText}15`, backgroundColor: tokens.colorBackground }}
        >
          {navPages.map((page) => {
            const isActive = page.slug === currentSlug;
            return (
              <Link
                key={page.id}
                href={`${basePath}/${page.slug}`}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-md text-sm font-medium transition-all"
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
          {hasPosts && (
            <Link
              href={`${basePath}/blog`}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-md text-sm font-medium transition-all"
              style={{
                color: isBlogActive ? tokens.colorAccent : tokens.colorText,
                backgroundColor: isBlogActive ? `${tokens.colorAccent}18` : "transparent",
                opacity: isBlogActive ? 1 : 0.75,
              }}
            >
              {blogLabel ?? "Blog"}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
