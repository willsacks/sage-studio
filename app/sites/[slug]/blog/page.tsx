import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedSiteBySlug, getCachedPublishedPagesForSite } from "@/lib/queries/sites";
import { getCachedPublishedPostsForSite } from "@/lib/queries/site-posts";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteUnpublishedMessage } from "@/components/site/SiteUnpublishedMessage";
import { buildStyleCssVars, buildGoogleFontsUrl, getFontsForTokens, resolveStyleTokens } from "@/lib/styles";
import type { StyleTokens } from "@/lib/styles";
import { ORNAMENTS_BY_KEY, DEFAULT_ORNAMENT_KEY, buildOrnamentCssVars } from "@/lib/ornaments";
import { format } from "date-fns";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCachedSiteBySlug(slug);
  if (!site) return {};
  const siteName = site.site_title ?? site.name;
  return { title: { absolute: `Blog | ${siteName}` } };
}

export default async function SiteBlogArchivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [site, pages, posts] = await Promise.all([
    getCachedSiteBySlug(slug),
    getCachedPublishedPagesForSite(slug),
    getCachedPublishedPostsForSite(slug),
  ]);

  if (!site) notFound();
  if (!site.is_published) return <SiteUnpublishedMessage siteName={site.site_title ?? site.name} />;

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
        <h1 className="text-3xl font-bold mb-8" style={{ fontFamily: `"${tokens.fontDisplay}", serif` }}>Blog</h1>

        {posts.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Nothing published yet — check back soon.</p>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <Link key={post.id} href={`${basePath}/blog/${post.slug}`} className="block group">
                {post.cover_image_url && (
                  <img src={post.cover_image_url} alt="" className="w-full aspect-[3/1] object-cover rounded-xl mb-3" />
                )}
                <p className="text-xs opacity-60 mb-1">
                  {post.published_at ? format(new Date(post.published_at), "MMMM d, yyyy") : ""}
                </p>
                <h2 className="text-xl font-semibold group-hover:underline" style={{ color: tokens.colorText }}>
                  {post.title}
                </h2>
                {post.excerpt && <p className="text-sm mt-1 opacity-75">{post.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </main>

      <SiteFooter footerText={site.footer_text} tokens={tokens as StyleTokens} />
    </div>
  );
}
