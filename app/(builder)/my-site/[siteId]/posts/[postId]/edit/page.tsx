import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { getSitePostById } from "@/lib/queries/site-posts";
import { PostEditor } from "@/components/site/PostEditor";
import { getSiteRole, hasAtLeast } from "@/lib/access/site-access";

export default async function SitePostEditPage({
  params,
}: {
  params: Promise<{ siteId: string; postId: string }>;
}) {
  const { siteId, postId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [site, post] = await Promise.all([
    getSiteById(siteId),
    getSitePostById(postId),
  ]);

  if (!site) notFound();
  if (!post || post.site_id !== siteId) notFound();
  const role = await getSiteRole(supabase, siteId, user.id);
  if (!role) notFound();
  if (!hasAtLeast(role, "editor")) redirect(`/my-site/${siteId}`);

  const hasCustomDomain = !!(site.custom_domain && site.custom_domain_verified);
  const siteUrl = hasCustomDomain ? `https://${site.custom_domain}` : `/sites/${site.slug}`;

  return <PostEditor siteId={siteId} siteUrl={siteUrl} blogSlug={site.blog_slug} post={post} />;
}
