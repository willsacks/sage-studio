"use client";

import { Builder } from "@/components/offer-builder/Builder";
import { saveSitePage } from "@/lib/actions/sites";
import type { SitePage, ArtistSite } from "@/lib/queries/sites";
import type { OfferTemplate } from "@/lib/queries/offer-templates";
import type { OfferPage } from "@/lib/queries/offer-pages";
import type { PageData, PageTheme } from "@/lib/types/builder";
import { THEMES_BY_KEY, DEFAULT_STYLE_KEY, buildStyleCssVars } from "@/lib/styles";
import { ORNAMENTS_BY_KEY, DEFAULT_ORNAMENT_KEY, buildOrnamentCssVars } from "@/lib/ornaments";

interface SitePageBuilderProps {
  page: SitePage;
  site: ArtistSite;
  allPages: SitePage[];
  username: string | null;
  isAdmin: boolean;
  templates: { platform: OfferTemplate[]; personal: OfferTemplate[]; promoted: OfferTemplate[] };
}

export function SitePageBuilder({ page, site, allPages, username, isAdmin, templates }: SitePageBuilderProps) {
  const asOfferPage = {
    ...page,
    owner_id: page.user_id,
    owner_type: "artist" as const,
    publish_mode: "subdirectory" as const,
    custom_domain: site.custom_domain,
    custom_domain_verified: site.custom_domain_verified,
    program_key: null,
    meta_title: page.meta_title ?? null,
    meta_description: page.meta_description ?? null,
    og_image: page.og_image ?? null,
    og_title: page.og_title ?? null,
    og_description: page.og_description ?? null,
  } as unknown as OfferPage;

  async function handleSave(id: string, data: { title: string; page_data: PageData; theme?: PageTheme }) {
    return saveSitePage(id, { ...data, siteId: site.id });
  }

  async function handlePublish(id: string, published: boolean) {
    await saveSitePage(id, { status: published ? "published" : "draft", siteId: site.id });
  }

  async function handleSaveSettings(id: string, data: { slug: string; publish_mode: string; custom_domain?: string; og_image?: string | null; og_title?: string | null; og_description?: string | null }) {
    await saveSitePage(id, { slug: data.slug, og_image: data.og_image, og_title: data.og_title, og_description: data.og_description, siteId: site.id });
  }

  const styleKey = site.style_key ?? DEFAULT_STYLE_KEY;
  const { tokens } = THEMES_BY_KEY[styleKey] ?? THEMES_BY_KEY[DEFAULT_STYLE_KEY];
  const siteStyleVars = buildStyleCssVars(tokens);
  const ornamentKey = (site as { ornamentation_key?: string | null }).ornamentation_key ?? DEFAULT_ORNAMENT_KEY;
  const ornamentTokens = (ORNAMENTS_BY_KEY[ornamentKey] ?? ORNAMENTS_BY_KEY[DEFAULT_ORNAMENT_KEY]).tokens;
  const ornamentStyleVars = buildOrnamentCssVars(ornamentTokens);

  const previewUrl = `/sites/${site.slug}/${page.slug}`;

  const siteContext = {
    siteSlug: site.slug,
    pages: allPages.map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
  };

  return (
    <Builder
      page={asOfferPage}
      artistUsername={username}
      isAdmin={isAdmin}
      templates={templates}
      saveAction={handleSave}
      publishAction={handlePublish}
      saveSettingsAction={handleSaveSettings}
      siteContext={siteContext}
      siteStyleVars={siteStyleVars}
      ornamentStyleVars={ornamentStyleVars}
      previewUrlOverride={previewUrl}
      backUrl={`/my-site/${site.id}`}
    />
  );
}
