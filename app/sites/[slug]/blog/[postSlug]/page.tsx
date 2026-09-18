import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedSiteBySlug, getCachedPublishedPagesForSite } from "@/lib/queries/sites";
import { getCachedPublishedPostsForSite, getCachedPublishedPostBySlug } from "@/lib/queries/site-posts";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteUnpublishedMessage } from "@/components/site/SiteUnpublishedMessage";
import { SandboxedPostBody } from "@/components/site/SandboxedPostBody";
import { buildStyleCssVars, buildGoogleFontsUrl, getFontsForTokens, resolveStyleTokens } from "@/lib/styles";
import type { StyleTokens } from "@/lib/styles";
import { ORNAMENTS_BY_KEY, DEFAULT_ORNAMENT_KEY, buildOrnamentCssVars } from "@/lib/ornaments";
import { format } from "date-fns";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const [post, site] = await Promise.all([
    getCachedPublishedPostBySlug(slug, postSlug),
    getCachedSiteBySlug(slug),
  ]);
  if (!post) return { title: { absolute: "Not Found" } };
  const postTitle = post.meta_title ?? post.title;
  const siteName = site?.site_title ?? site?.name;
  const title = siteName ? `${postTitle} | ${siteName}` : postTitle;
  return {
    title: { absolute: title },
    description: post.meta_description ?? post.excerpt ?? undefined,
    openGraph: {
      title: postTitle,
      description: post.meta_description ?? post.excerpt ?? undefined,
      images: post.cover_image_url ? [{ url: post.cover_image_url, width: 1200, height: 630 }] : [],
      type: "article",
    },
  };
}

export default async function SiteBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const [site, post, pages, posts] = await Promise.all([
    getCachedSiteBySlug(slug),
    getCachedPublishedPostBySlug(slug, postSlug),
    getCachedPublishedPagesForSite(slug),
    getCachedPublishedPostsForSite(slug),
  ]);

  if (!site) notFound();
  if (!site.is_published) return <SiteUnpublishedMessage siteName={site.site_title ?? site.name} />;
  if (!post) notFound();

  const tokens = resolveStyleTokens(site);
  const cssVars = buildStyleCssVars(tokens);
  const ornamentKey = (site as { ornamentation_key?: string | null }).ornamentation_key ?? DEFAULT_ORNAMENT_KEY;
  const ornamentTokens = (ORNAMENTS_BY_KEY[ornamentKey] ?? ORNAMENTS_BY_KEY[DEFAULT_ORNAMENT_KEY]).tokens;
  const ornamentVars = buildOrnamentCssVars(ornamentTokens);
  const fontsUrl = buildGoogleFontsUrl(getFontsForTokens(tokens));
  const fontScale = site.font_scale ?? 1;
  const basePath = (site.custom_domain && site.custom_domain_verified) ? `https://${site.custom_domain}` : `/sites/${slug}`;

  return (
    <div style={{ backgroundColor: tokens.colorBackground, minHeight: "100vh", color: tokens.colorText }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontsUrl} />
      <style>{`
        html { font-size: calc(16px * ${fontScale}); }
        :root { ${cssVars} ${ornamentVars} }
        body { font-family: "${tokens.fontBody}", serif; color: ${tokens.colorText}; }
      `}</style>

      <SiteNav siteSlug={slug} pages={pages} currentSlug="" site={site} tokens={tokens as StyleTokens} basePath={basePath} hasPosts={posts.length > 0} isBlogActive />

      <main className="max-w-3xl mx-auto px-6 py-12">
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt="" className="w-full aspect-[3/1] object-cover rounded-xl mb-6" />
        )}
        <p className="text-xs opacity-60 mb-2">
          {post.published_at ? format(new Date(post.published_at), "MMMM d, yyyy") : ""}
        </p>
        <h1 className="text-3xl font-bold mb-6" style={{ fontFamily: `"${tokens.fontDisplay}", serif` }}>
          {post.title}
        </h1>
        {post.html_content && <SandboxedPostBody html={post.html_content} />}
      </main>

      <SiteFooter footerText={site.footer_text} tokens={tokens as StyleTokens} />
    </div>
  );
}
