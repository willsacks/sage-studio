import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, getSitePageById, getPagesForSite } from "@/lib/queries/sites";
import { getCoursesForOwner } from "@/lib/queries/courses";
import { getPlatformTemplates, getMyTemplates } from "@/lib/queries/offer-templates";
import { SitePageBuilder } from "@/components/site/SitePageBuilder";
import { isPlatformStaff } from "@/lib/access/platform-access";
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
    .select("username, role, ai_assistant_enabled")
    .eq("id", user.id)
    .single();
  const aiEnabled = profile?.ai_assistant_enabled ?? false;

  const [site, page, allPages, platformTemplates, personalTemplates] = await Promise.all([
    getSiteById(siteId),
    getSitePageById(pageId),
    getPagesForSite(siteId),
    getPlatformTemplates(),
    getMyTemplates(),
  ]);

  if (!site) notFound();
  const courses = await getCoursesForOwner(site.user_id);
  if (!page) notFound();
  const role = await getSiteRole(supabase, siteId, user.id);
  if (!role) notFound();

  if (!hasAtLeast(role, "editor")) {
    return <ReadOnlyPageView page={page} site={site} />;
  }

  if (page.page_type === "html") {
    const customDomain = site.custom_domain_verified ? site.custom_domain : null;
    return <HtmlPageEditor page={page as Parameters<typeof HtmlPageEditor>[0]["page"]} siteId={siteId} siteSlug={site.slug} customDomain={customDomain} aiEnabled={aiEnabled} />;
  }

  return (
    <SitePageBuilder
      page={page}
      site={site}
      allPages={allPages}
      username={profile?.username ?? null}
      isAdmin={isPlatformStaff(profile?.role)}
      aiEnabled={aiEnabled}
      templates={{
        platform: platformTemplates,
        personal: personalTemplates,
        promoted: [],
      }}
      courses={courses.filter((c) => c.status === "published" && c.price_cents).map((c) => ({ id: c.id, title: c.title, priceCents: c.price_cents }))}
    />
  );
}
