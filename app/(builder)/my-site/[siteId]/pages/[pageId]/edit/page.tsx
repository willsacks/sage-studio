import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, getSitePageById, getPagesForSite } from "@/lib/queries/sites";
import { SitePageBuilder } from "@/components/site/SitePageBuilder";
import { HtmlPageEditor } from "@/components/site/HtmlPageEditor";
import { ReadOnlyPageView } from "@/components/site/ReadOnlyPageView";
import { getSiteRole, hasAtLeast } from "@/lib/access/site-access";

export default async function SitePageEditPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role")
    .eq("id", user.id)
    .single();

  const platformTemplates: never[] = [];
  const personalTemplates: never[] = [];

  const [site, page, allPages] = await Promise.all([
    getSiteById(siteId),
    getSitePageById(pageId),
    getPagesForSite(siteId),
  ]);

  if (!site) notFound();
  if (!page) notFound();
  const role = await getSiteRole(supabase, siteId, user.id);
  if (!role) notFound();

  if (!hasAtLeast(role, "editor")) {
    return <ReadOnlyPageView page={page} site={site} />;
  }

  if (page.page_type === "html") {
    return <HtmlPageEditor page={page as Parameters<typeof HtmlPageEditor>[0]["page"]} siteId={siteId} siteSlug={site.slug} />;
  }

  return (
    <SitePageBuilder
      page={page}
      site={site}
      allPages={allPages}
      username={profile?.username ?? null}
      isAdmin={profile?.role === "admin"}
      templates={{
        platform: platformTemplates,
        personal: personalTemplates,
        promoted: [],
      }}
    />
  );
}
