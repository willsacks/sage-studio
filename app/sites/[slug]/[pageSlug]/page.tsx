import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteBySlug, getPublishedPageBySlug, getPublishedPagesForSite } from "@/lib/queries/sites";
import { OfferPageBlocks } from "@/components/offer-builder/OfferPageBlocks";
import { SiteNav } from "@/components/site/SiteNav";
import type { PageData } from "@/lib/types/builder";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY, buildStyleCssVars, buildGoogleFontsUrl, getFontsForTokens } from "@/lib/styles";
import type { StyleTokens } from "@/lib/styles";
import { ORNAMENTS_BY_KEY, DEFAULT_ORNAMENT_KEY, buildOrnamentCssVars } from "@/lib/ornaments";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const [page, site] = await Promise.all([
    getPublishedPageBySlug(slug, pageSlug),
    getSiteBySlug(slug),
  ]);
  if (!page) return { title: "Not Found" };
  const ogTitle = page.og_title ?? page.meta_title ?? page.title;
  const ogDescription = page.og_description ?? page.meta_description ?? undefined;
  const siteUrl = site?.custom_domain && site.custom_domain_verified
    ? `https://${site.custom_domain}`
    : `https://sagestudio.org/sites/${slug}`;
  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    icons: (site as { favicon_url?: string | null })?.favicon_url
      ? { icon: (site as { favicon_url?: string | null }).favicon_url! }
      : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: page.og_image ? [{ url: page.og_image, width: 1200, height: 630 }] : [],
      type: "website",
      url: `${siteUrl}/${pageSlug}`,
    },
    twitter: {
      card: page.og_image ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      images: page.og_image ? [page.og_image] : [],
    },
  };
}

export default async function PublicSitePageRoute({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;

  const [site, page, allPages] = await Promise.all([
    getSiteBySlug(slug),
    getPublishedPageBySlug(slug, pageSlug),
    getPublishedPagesForSite(slug),
  ]);

  if (!site || !site.is_published || !page) notFound();

  const styleKey = site.style_key ?? DEFAULT_STYLE_KEY;
  const siteStyle = THEMES_BY_KEY[styleKey] ?? THEMES_BY_KEY[DEFAULT_STYLE_KEY];
  const { tokens } = siteStyle;

  const cssVars = buildStyleCssVars(tokens);
  const ornamentKey = (site as { ornamentation_key?: string | null }).ornamentation_key ?? DEFAULT_ORNAMENT_KEY;
  const ornamentTokens = (ORNAMENTS_BY_KEY[ornamentKey] ?? ORNAMENTS_BY_KEY[DEFAULT_ORNAMENT_KEY]).tokens;
  const ornamentVars = buildOrnamentCssVars(ornamentTokens);
  const fontsUrl = buildGoogleFontsUrl(getFontsForTokens(tokens));
  const fontScale = site.font_scale ?? 1;
  const blocks = (page.page_data as unknown as PageData) ?? [];
  const hasCornerNav = blocks.some((b) => b.type === "corner_nav");
  const showHeader = !hasCornerNav && !page.hide_header;
  const basePath = (site.custom_domain && site.custom_domain_verified)
    ? `https://${site.custom_domain}`
    : `/sites/${slug}`;

  return (
    <div style={{ backgroundColor: tokens.colorBackground, minHeight: "100vh", color: tokens.colorText }}>
      <style>{`
        @import url('${fontsUrl}');
        html { font-size: calc(16px * ${fontScale}); }
        :root { ${cssVars} ${ornamentVars} }
        body { font-family: "${tokens.fontBody}", serif; color: ${tokens.colorText}; }
      `}</style>

      {showHeader && (
        <SiteNav
          siteSlug={slug}
          pages={allPages}
          currentSlug={pageSlug}
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
