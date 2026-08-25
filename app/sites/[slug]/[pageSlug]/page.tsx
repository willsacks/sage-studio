import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedSiteBySlug, getCachedPublishedPageBySlug, getCachedPublishedPagesForSite } from "@/lib/queries/sites";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const [page, site] = await Promise.all([
    getCachedPublishedPageBySlug(slug, pageSlug),
    getCachedSiteBySlug(slug),
  ]);
  if (!page) return { title: { absolute: "Not Found" } };
  const pageTitle = page.meta_title ?? page.title;
  const siteName = site?.site_title ?? site?.name;
  const title = siteName ? `${pageTitle} | ${siteName}` : pageTitle;
  const ogTitle = page.og_title ?? pageTitle;
  const ogDescription = page.og_description ?? page.meta_description ?? undefined;
  const siteUrl = site?.custom_domain && site.custom_domain_verified
    ? `https://${site.custom_domain}`
    : `https://sagestudio.org/sites/${slug}`;
  const faviconUrl = (site as { favicon_url?: string | null } | null)?.favicon_url;
  return {
    // `absolute` bypasses the root layout's "%s | Sage Studio" title template —
    // artist sites shouldn't carry Sage Studio's own branding in the browser tab.
    title: { absolute: title },
    description: page.meta_description ?? undefined,
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
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
  searchParams,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug, pageSlug } = await params;
  const { scrollTo } = await searchParams;
  const scrollToId = typeof scrollTo === "string" && SCROLL_TO_ID_PATTERN.test(scrollTo) ? scrollTo : null;

  const [site, page, allPages] = await Promise.all([
    getCachedSiteBySlug(slug),
    getCachedPublishedPageBySlug(slug, pageSlug),
    getCachedPublishedPagesForSite(slug),
  ]);

  if (!site) notFound();
  if (!site.is_published) return <SiteUnpublishedMessage siteName={site.site_title ?? site.name} />;
  if (!page) notFound();

  const gateFields = getPageGateFields(page);
  const isUnlocked = await isPageUnlocked(page.id, gateFields.isGated);
  const gateOverlayProps = {
    siteSlug: slug,
    pageId: page.id,
    isUnlocked,
    gateTitle: gateFields.gateTitle,
    gateDescription: gateFields.gateDescription,
    gateButtonText: gateFields.gateButtonText,
  };

  // Standalone HTML page — render the uploaded HTML in a full-viewport iframe
  if (page.page_type === "html") {
    const htmlContent = (page as unknown as { html_content?: string | null }).html_content ?? "";
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
          title={page.title}
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
  const blocks = (page.page_data as unknown as PageData) ?? [];
  const hasCornerNav = blocks.some((b) => b.type === "corner_nav");
  const showHeader = !hasCornerNav && !page.hide_header;
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

        <SiteFooter footerText={site.footer_text} tokens={tokens as StyleTokens} />
      </div>
    </PageGateOverlay>
  );
}
