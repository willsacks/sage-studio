import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedSiteBySlug, getCachedPublishedPagesForSite } from "@/lib/queries/sites";
import { OfferPageBlocks } from "@/components/offer-builder/OfferPageBlocks";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteUnpublishedMessage } from "@/components/site/SiteUnpublishedMessage";
import { PageGateOverlay } from "@/components/site/PageGateOverlay";
import { getPageGateFields, isPageUnlocked } from "@/lib/utils/page-gate";
import type { PageData } from "@/lib/types/builder";
import { buildStyleCssVars, buildGoogleFontsUrl, getFontsForTokens, resolveStyleTokens } from "@/lib/styles";
import type { StyleTokens } from "@/lib/styles";
import { ORNAMENTS_BY_KEY, DEFAULT_ORNAMENT_KEY, buildOrnamentCssVars } from "@/lib/ornaments";
import { injectFormCaptureScript } from "@/lib/utils/form-capture-script";
import { injectAnchorScrollFix, injectScrollToOnLoad } from "@/lib/utils/anchor-scroll-fix-script";
import { injectTopNavigationFix } from "@/lib/utils/top-navigation-fix-script";

// Only a plain id — this gets embedded into an injected <script> (see
// injectScrollToOnLoad), so a query param that doesn't match this is
// dropped rather than trusted as-is.
const SCROLL_TO_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, pages] = await Promise.all([getCachedSiteBySlug(slug), getCachedPublishedPagesForSite(slug)]);
  if (!site) return {};
  const homePage = (site.home_page_id ? pages.find((p) => p.id === site.home_page_id) : null)
    ?? pages.find((p) => p.page_type === "home") ?? pages[0];
  const siteName = site.site_title ?? site.name;
  // Site-level title wins over the page's own internal label ("Home") here — the
  // Site Title field is documented as "shown in the browser tab", so it should be
  // what the tab actually shows, not the raw admin-facing page title.
  const title = homePage?.meta_title ?? siteName;
  const description = homePage?.meta_description ?? undefined;
  const ogTitle = homePage?.og_title ?? title;
  const ogDescription = homePage?.og_description ?? description;
  const siteUrl = site.custom_domain && site.custom_domain_verified
    ? `https://${site.custom_domain}`
    : `https://sagestudio.org/sites/${slug}`;
  const faviconUrl = (site as { favicon_url?: string | null }).favicon_url;
  return {
    // `absolute` bypasses the root layout's "%s | Sage Studio" title template —
    // artist sites (especially on their own custom domains) shouldn't carry
    // Sage Studio's own branding in the browser tab.
    title: { absolute: title },
    description,
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
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

export default async function SiteRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const { scrollTo } = await searchParams;
  const scrollToId = typeof scrollTo === "string" && SCROLL_TO_ID_PATTERN.test(scrollTo) ? scrollTo : null;
  const [site, pages] = await Promise.all([
    getCachedSiteBySlug(slug),
    getCachedPublishedPagesForSite(slug),
  ]);

  if (!site) notFound();
  if (!site.is_published) return <SiteUnpublishedMessage siteName={site.site_title ?? site.name} />;

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

  const gateFields = getPageGateFields(homePage);
  const isUnlocked = await isPageUnlocked(homePage.id, gateFields.isGated);
  const gateOverlayProps = {
    siteSlug: slug,
    pageId: homePage.id,
    isUnlocked,
    gateTitle: gateFields.gateTitle,
    gateDescription: gateFields.gateDescription,
    gateButtonText: gateFields.gateButtonText,
  };

  // Standalone HTML page set as home — render the uploaded HTML in a full-viewport iframe
  if (homePage.page_type === "html") {
    const htmlContent = (homePage as unknown as { html_content?: string | null }).html_content ?? "";
    return (
      <PageGateOverlay {...gateOverlayProps}>
        <iframe
          srcDoc={injectTopNavigationFix(injectScrollToOnLoad(injectAnchorScrollFix(injectFormCaptureScript(htmlContent, slug)), scrollToId))}
          style={{ width: "100vw", height: "100vh", border: "none", display: "block" }}
          // No allow-same-origin — a visitor may be logged into Sage Studio in the
          // same browser (e.g. the artist previewing their own site); allow-scripts
          // + allow-same-origin together would let injected page HTML reach that
          // session via window.top as same-origin.
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation"
          title={homePage.title}
        />
      </PageGateOverlay>
    );
  }

  const tokens = resolveStyleTokens(site);
  const cssVars = buildStyleCssVars(tokens);
  const ornamentKey = (site as { ornamentation_key?: string | null }).ornamentation_key ?? DEFAULT_ORNAMENT_KEY;
  const ornamentTokens = (ORNAMENTS_BY_KEY[ornamentKey] ?? ORNAMENTS_BY_KEY[DEFAULT_ORNAMENT_KEY]).tokens;
  const ornamentVars = buildOrnamentCssVars(ornamentTokens);
  const fontsUrl = buildGoogleFontsUrl(getFontsForTokens(tokens));
  const fontScale = site.font_scale ?? 1;
  const blocks = (homePage.page_data as unknown as PageData) ?? [];
  const hasCornerNav = blocks.some((b) => b.type === "corner_nav");
  const showHeader = !hasCornerNav && !homePage.hide_header;
  const basePath = (site.custom_domain && site.custom_domain_verified)
    ? `https://${site.custom_domain}`
    : `/sites/${slug}`;

  return (
    <PageGateOverlay {...gateOverlayProps}>
      <div style={{ backgroundColor: tokens.colorBackground, minHeight: "100vh", color: tokens.colorText }}>
        {/* Rendered directly in the tree (not a client-side injected tag) — React
            hoists title/meta/link/style elements to <head> wherever they render,
            so this still ends up in <head> while letting the browser discover
            and fetch the font CSS in parallel with the rest of the document,
            instead of behind it like the old @import inside <style> did. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontsUrl} />
        <style>{`
          html { font-size: calc(16px * ${fontScale}); }
          :root { ${cssVars} ${ornamentVars} }
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

        <SiteFooter footerText={site.footer_text} tokens={tokens as StyleTokens} />
      </div>
    </PageGateOverlay>
  );
}
