import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, getPagesForSite } from "@/lib/queries/sites";
import { getFormSubmissionsForSite } from "@/lib/queries/form-submissions";
import { toggleSitePublished } from "@/lib/actions/sites";
import { MarkSubmissionsReadOnMount } from "@/components/site/MarkSubmissionsReadOnMount";
import { NotificationEmailForm } from "@/components/site/NotificationEmailForm";
import { ResendConnectForm } from "@/components/site/ResendConnectForm";
import { ArrowLeft, Globe, ExternalLink, Settings, Eye, EyeOff, Palette } from "lucide-react";
import { format } from "date-fns";
import { PageTypePicker } from "@/components/site/PageTypePicker";
import { ImportHtmlButton } from "@/components/site/ImportHtmlButton";
import { PagesManager } from "@/components/site/PagesManager";
import { getSiteRole, hasAtLeast } from "@/lib/access/site-access";

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }): Promise<Metadata> {
  const { siteId } = await params;
  const site = await getSiteById(siteId);
  return { title: site ? `${site.name} — Pages` : "Site" };
}


export default async function SitePageManagerPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const platformTemplates: never[] = [];
  const personalTemplates: never[] = [];

  const [site, pages] = await Promise.all([
    getSiteById(siteId),
    getPagesForSite(siteId),
  ]);
  if (!site) notFound();
  const role = await getSiteRole(supabase, siteId, user.id);
  if (!role) notFound();
  const canEdit = hasAtLeast(role, "editor");
  const canManage = hasAtLeast(role, "manager");

  const submissions = canEdit ? await getFormSubmissionsForSite(site.slug) : [];
  const unreadSubmissions = submissions.filter((s) => !s.is_read).length;

  const homePageId = site.home_page_id ?? pages.find((p) => p.page_type === "home")?.id ?? pages[0]?.id;

  const hasCustomDomain = !!(site.custom_domain && site.custom_domain_verified);
  const siteUrl = hasCustomDomain
    ? `https://${site.custom_domain}`
    : `/sites/${site.slug}`;
  const displayUrl = hasCustomDomain
    ? site.custom_domain!
    : `sagestudio.org/sites/${site.slug}`;
  const copyUrl = hasCustomDomain
    ? `https://${site.custom_domain}`
    : `https://www.sagestudio.org/sites/${site.slug}`;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link
          href="/my-site"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={14} /> All Websites
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {site.logo_url && <img src={site.logo_url} alt="" className="h-7 w-7 object-contain" />}
            {site.name}
          </h1>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-sm text-[var(--muted-foreground)]">
              {displayUrl}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {site.is_published && (
            <Link
              href={siteUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
            >
              <ExternalLink size={13} /> View
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/my-site/${siteId}/style`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
            >
              <Palette size={13} /> Style
            </Link>
          )}
          {canManage && (
            <Link
              href={`/my-site/${siteId}/settings`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
            >
              <Settings size={13} /> Settings
            </Link>
          )}
          {canEdit && (
            <form action={async () => {
              "use server";
              await toggleSitePublished(siteId, !site.is_published);
            }}>
              <button
                type="submit"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  site.is_published
                    ? "border border-[var(--border)] hover:bg-[var(--accent)]"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                }`}
              >
                {site.is_published
                  ? <><EyeOff size={13} /> Unpublish</>
                  : <><Eye size={13} /> Publish</>
                }
              </button>
            </form>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="px-4 py-2 rounded-lg bg-[var(--muted)]/50 text-xs text-[var(--muted-foreground)]">
          You have view-only access to this site.
        </div>
      )}

      {/* Pages section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--foreground)]">Pages</h2>
          {canEdit && (
            <div className="flex items-center gap-2">
              <ImportHtmlButton siteId={siteId} />
              <PageTypePicker siteId={siteId} existingTypes={pages.map((p) => p.page_type as "home" | "about" | "work" | "contact" | "custom")} templates={{ platform: platformTemplates, personal: personalTemplates }} />
            </div>
          )}
        </div>

        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed border-[var(--border)] rounded-xl">
            <Globe size={32} className="text-[var(--muted-foreground)] opacity-30" />
            <div className="text-center">
              <p className="font-medium text-[var(--foreground)]">No pages yet</p>
              {canEdit && <p className="text-sm text-[var(--muted-foreground)] mt-1">Add your first page to get started.</p>}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <ImportHtmlButton siteId={siteId} />
                <PageTypePicker siteId={siteId} existingTypes={[]} />
              </div>
            )}
          </div>
        ) : (
          <PagesManager
            siteId={siteId}
            siteUrl={siteUrl}
            pages={pages}
            homePageId={homePageId}
            canEdit={canEdit}
          />
        )}
      </div>

      {/* Form Submissions */}
      {canEdit && (
      <div>
        {unreadSubmissions > 0 && <MarkSubmissionsReadOnMount siteSlug={site.slug} />}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-semibold text-[var(--foreground)]">Form Submissions</h2>
          {unreadSubmissions > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-bold">
              {unreadSubmissions} new
            </span>
          )}
        </div>

        {canManage && (
          <>
            <NotificationEmailForm
              siteId={siteId}
              currentEmail={(site as { notification_email?: string | null }).notification_email ?? null}
            />
            <ResendConnectForm
              siteId={siteId}
              isConnected={!!(site as { resend_audience_id?: string | null }).resend_audience_id}
            />
          </>
        )}

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 border border-dashed border-[var(--border)] rounded-xl text-center">
            <p className="text-sm text-[var(--muted-foreground)]">No submissions yet.</p>
            <p className="text-xs text-[var(--muted-foreground)] opacity-70">Applications submitted through your form blocks will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => {
              const pairs = sub.questions.map((q) => ({
                label: q.label,
                type: q.type,
                answer: sub.answers[q.id] ?? "",
              })).filter((p) => p.answer);
              return (
                <details
                  key={sub.id}
                  className="group rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
                >
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none list-none">
                    {!sub.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {sub.answers[sub.questions.find((q) => q.type === "short_text")?.id ?? ""] ||
                          sub.answers[sub.questions[0]?.id ?? ""] ||
                          "Anonymous"}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {sub.form_title} · {format(new Date(sub.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <span className="text-[var(--muted-foreground)] text-xs group-open:hidden">View</span>
                    <span className="text-[var(--muted-foreground)] text-xs hidden group-open:inline">Close</span>
                  </summary>
                  <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                    {pairs.map(({ label, type, answer }) => (
                      <div key={label}>
                        <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">{label}</p>
                        <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                          {type === "select_multiple" ? answer.split("|||").join(", ") : answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
