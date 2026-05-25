import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteBySlug, getPublishedPagesForSite } from "@/lib/queries/sites";
import { OfferPageBlocks } from "@/components/offer-builder/OfferPageBlocks";
import { SiteNav } from "@/components/site/SiteNav";
import type { PageData } from "@/lib/types/builder";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY, buildStyleCssVars, buildGoogleFontsUrl, getFontsForTokens } from "@/lib/styles";
import type { StyleTokens } from "@/lib/styles";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, pages] = await Promise.all([getSiteBySlug(slug), getPublishedPagesForSite(slug)]);
  if (!site) return {};
  const homePage = (site.home_page_id ? pages.find((p) => p.id === site.home_page_id) : null)
    ?? pages.find((p) => p.page_type === "home") ?? pages[0];
  const title = homePage?.meta_title ?? homePage?.title ?? site.site_title ?? site.name;
  const description = homePage?.meta_description ?? undefined;
  const ogTitle = homePage?.og_title ?? title;
  const ogDescription = homePage?.og_description ?? description;
  const siteUrl = site.custom_domain && site.custom_domain_verified
    ? `https://${site.custom_domain}`
    : `https://sagestudio.org/sites/${slug}`;
  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: homePage?.og_image ? [{ url: homePage.og_image, width: 1200, height: 630 }] : [],
      type: "website",
      url: siteUrl,
    },
    twitter: {
      card: homePage?.og_image ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      images: homePage?.og_image ? [homePage.og_image] : [],
    },
  };
}

export default async function SiteRootPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [site, pages] = await Promise.all([
    getSiteBySlug(slug),
    getPublishedPagesForSite(slug),
  ]);

  if (!site || !site.is_published) notFound();

  const homePage =
    (site.home_page_id ? pages.find((p) => p.id === site.home_page_id) : null) ??
    pages.find((p) => p.page_type === "home") ??
    pages[0];

  if (!homePage) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            {site.site_title ?? site.name}
          </h1>
          <p style={{ color: "#6b7280" }}>Coming soon.</p>
        </div>
      </div>
    );
  }

  const styleKey = site.style_key ?? DEFAULT_STYLE_KEY;
  const siteStyle = THEMES_BY_KEY[styleKey] ?? THEMES_BY_KEY[DEFAULT_STYLE_KEY];
  const { tokens } = siteStyle;
  const cssVars = buildStyleCssVars(tokens);
  const fontsUrl = buildGoogleFontsUrl(getFontsForTokens(tokens));
  const fontScale = site.font_scale ?? 1;
  const blocks = (homePage.page_data as unknown as PageData) ?? [];
  const hasCornerNav = blocks.some((b) => b.type === "corner_nav");
  const showHeader = !hasCornerNav && !homePage.hide_header;
  const basePath = (site.custom_domain && site.custom_domain_verified)
    ? `https://${site.custom_domain}`
    : `/sites/${slug}`;

  return (
    <div style={{ backgroundColor: tokens.colorBackground, minHeight: "100vh", color: tokens.colorText }}>
      <style>{`
        @import url('${fontsUrl}');
        html { font-size: calc(16px * ${fontScale}); }
        :root { ${cssVars} }
        body { font-family: "${tokens.fontBody}", serif; color: ${tokens.colorText}; }
      `}</style>

      {showHeader && (
        <SiteNav
          siteSlug={slug}
          pages={pages}
          currentSlug={homePage.slug}
          site={site}
          tokens={tokens as StyleTokens}
          basePath={basePath}
        />
      )}

      <main>
        <OfferPageBlocks blocks={blocks} basePath={basePath} siteSlug={slug} />
      </main>
    </div>
  );
}
