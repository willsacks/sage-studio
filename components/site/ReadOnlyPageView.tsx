import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import type { ArtistSite, SitePage } from "@/lib/queries/sites";
import { OfferPageBlocks } from "@/components/offer-builder/OfferPageBlocks";
import type { PageData } from "@/lib/types/builder";
import { buildStyleCssVars, buildGoogleFontsUrl, getFontsForTokens, resolveStyleTokens } from "@/lib/styles";
import { ORNAMENTS_BY_KEY, DEFAULT_ORNAMENT_KEY, buildOrnamentCssVars } from "@/lib/ornaments";

export function ReadOnlyPageView({ page, site }: { page: SitePage; site: ArtistSite }) {
  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <Link
          href={`/my-site/${site.id}`}
          className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </Link>
        <span className="text-[var(--border)]">/</span>
        <span className="text-sm font-medium truncate max-w-[200px]">{page.title}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] font-medium">
          <Eye size={11} /> View only
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {page.page_type === "html" ? (
          <iframe
            srcDoc={page.html_content ?? ""}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title={page.title}
          />
        ) : (
          <BlockPagePreview page={page} site={site} />
        )}
      </div>
    </div>
  );
}

function BlockPagePreview({ page, site }: { page: SitePage; site: ArtistSite }) {
  const tokens = resolveStyleTokens(site);
  const cssVars = buildStyleCssVars(tokens);
  const ornamentKey = site.ornamentation_key ?? DEFAULT_ORNAMENT_KEY;
  const ornamentTokens = (ORNAMENTS_BY_KEY[ornamentKey] ?? ORNAMENTS_BY_KEY[DEFAULT_ORNAMENT_KEY]).tokens;
  const ornamentVars = buildOrnamentCssVars(ornamentTokens);
  const fontsUrl = buildGoogleFontsUrl(getFontsForTokens(tokens));
  const fontScale = site.font_scale ?? 1;
  const blocks = (page.page_data as unknown as PageData) ?? [];

  return (
    <div style={{ backgroundColor: tokens.colorBackground, minHeight: "100%", color: tokens.colorText }}>
      <style>{`
        @import url('${fontsUrl}');
        .readonly-page-preview { font-size: calc(16px * ${fontScale}); }
        .readonly-page-preview { ${cssVars} ${ornamentVars} }
        .readonly-page-preview { font-family: "${tokens.fontBody}", serif; color: ${tokens.colorText}; }
      `}</style>
      <main className="readonly-page-preview">
        <OfferPageBlocks blocks={blocks} basePath={`/sites/${site.slug}`} siteSlug={site.slug} />
      </main>
    </div>
  );
}
