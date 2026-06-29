"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PageData, PageTheme } from "@/lib/types/builder";
import type { Json } from "@/lib/db";
import { addDomainToProject, removeDomainFromProject, getDomainStatus } from "@/lib/vercel-domains";
import { requireSiteRole, requirePageRole } from "@/lib/access/site-access";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function createSite(formData: FormData) {
  const { supabase, user } = await requireAuth();

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required" };

  const rawSlug = (formData.get("slug") as string)?.trim();
  const slug = rawSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { data, error } = await supabase
    .from("artist_sites")
    .insert({ user_id: user.id, name, slug })
    .select("id")
    .single();

  if (error) return { error: error.message };
  redirect(`/my-site/${data.id}`);
}

export async function createSiteWithStyle(name: string, styleKey: string): Promise<{ siteId?: string; error?: string }> {
  const { supabase, user } = await requireAuth();

  if (!name.trim()) return { error: "Name is required" };

  const { count: siteCount } = await supabase
    .from("artist_sites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { data: profile } = await supabase
    .from("profiles").select("tier_key, role").eq("id", user.id).single();
  const { isProPlan } = await import("@/lib/plan-gates");
  const { canCreateSite } = await import("@/lib/plan-gates");
  const plan = isProPlan(profile?.tier_key ?? "", profile?.role) ? "pro" as const : "free" as const;
  if (!canCreateSite(plan, siteCount ?? 0)) {
    return { error: "Upgrade to Pro to create more than 1 site" };
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { data, error } = await supabase
    .from("artist_sites")
    .insert({ user_id: user.id, name: name.trim(), slug, style_key: styleKey })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/my-site");
  return { siteId: data.id };
}

export async function setSiteStyle(siteId: string, styleKey: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");
  await supabase
    .from("artist_sites")
    .update({ style_key: styleKey, updated_at: new Date().toISOString() })
    .eq("id", siteId);
  revalidatePath(`/my-site/${siteId}/style`);
  return { success: true };
}

export async function setSiteOrnamentation(siteId: string, ornamentKey: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("artist_sites")
    .update({ ornamentation_key: ornamentKey, updated_at: new Date().toISOString() })
    .eq("id", siteId);
  revalidatePath(`/my-site/${siteId}/style`);
  return { success: true };
}

export async function setSiteFontScale(siteId: string, fontScale: number) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");
  await supabase
    .from("artist_sites")
    .update({ font_scale: fontScale, updated_at: new Date().toISOString() })
    .eq("id", siteId);
  revalidatePath(`/my-site/${siteId}/style`);
  return { success: true };
}

export async function updateSite(siteId: string, formData: FormData) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("artist_sites")
    .update({
      name: (formData.get("name") as string)?.trim(),
      site_title: (formData.get("site_title") as string)?.trim() || null,
      site_tagline: (formData.get("site_tagline") as string)?.trim() || null,
      logo_url: (formData.get("logo_url") as string) || null,
      favicon_url: (formData.get("favicon_url") as string) || null,
      footer_text: (formData.get("footer_text") as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", siteId);

  if (error) return { error: error.message };
  revalidatePath(`/my-site/${siteId}`);
  return { success: true };
}

export async function toggleSitePublished(siteId: string, isPublished: boolean) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");
  await supabase
    .from("artist_sites")
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", siteId);
  revalidatePath(`/my-site/${siteId}`);
  return { success: true };
}

export async function setHomePage(siteId: string, pageId: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");
  await supabase
    .from("artist_sites")
    .update({ home_page_id: pageId } as never)
    .eq("id", siteId);
  revalidatePath(`/my-site/${siteId}`);
}

export async function deleteSite(siteId: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "owner");
  await supabase.from("artist_sites").delete().eq("id", siteId);
  revalidatePath("/my-site");
}

export async function createSitePage(siteId: string, formData: FormData) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");

  const title = (formData.get("title") as string)?.trim() || "New Page";
  const page_type = (formData.get("page_type") as string) || "custom";
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const slug = page_type === "home" ? "home" : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { count } = await supabase
    .from("site_pages")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);

  const { data, error } = await supabase
    .from("site_pages")
    .insert({
      user_id: user.id,
      site_id: siteId,
      title,
      slug,
      page_type: page_type as "home" | "about" | "work" | "contact" | "custom",
      sort_order: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/my-site/${siteId}`);
  redirect(`/my-site/${siteId}/pages/${data.id}/edit`);
}

// Used by PageTypePicker — returns pageId instead of redirecting so dialog can close
export async function addSitePage(
  siteId: string,
  title: string,
  pageType: string,
  pageData?: PageData,
  theme?: PageTheme
): Promise<{ pageId?: string; error?: string }> {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "editor");

  // Plan limits are tied to the site owner's plan, not the acting collaborator's.
  const { data: site } = await supabase.from("artist_sites").select("user_id").eq("id", siteId).single();
  const { data: profile } = await supabase
    .from("profiles").select("tier_key, role").eq("id", site?.user_id ?? user.id).single();
  const { isProPlan, canAddPage } = await import("@/lib/plan-gates");
  const plan = isProPlan(profile?.tier_key ?? "", profile?.role) ? "pro" as const : "free" as const;

  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const slug = pageType === "home" ? "home" : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { count } = await supabase
    .from("site_pages")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);

  if (!canAddPage(plan, count ?? 0)) {
    return { error: "Upgrade to Pro to add more than 5 pages per site" };
  }

  const { data, error } = await supabase
    .from("site_pages")
    .insert({
      user_id: user.id,
      site_id: siteId,
      title,
      slug,
      page_type: pageType as "home" | "about" | "work" | "contact" | "custom",
      sort_order: count ?? 0,
      ...(pageData !== undefined ? { page_data: pageData as unknown as Json } : {}),
      ...(theme !== undefined ? { theme: theme as unknown as Json } : {}),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/my-site/${siteId}`);
  return { pageId: data.id };
}

export async function saveSitePage(
  pageId: string,
  data: {
    title?: string;
    page_data?: PageData;
    theme?: PageTheme;
    status?: "draft" | "published";
    meta_title?: string;
    meta_description?: string;
    og_image?: string | null;
    og_title?: string | null;
    og_description?: string | null;
    slug?: string;
    siteId?: string;
  }
) {
  const { supabase, user } = await requireAuth();
  await requirePageRole(supabase, pageId, user.id, "editor");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("site_pages")
    .update({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.page_data !== undefined ? { page_data: data.page_data as unknown as Json } : {}),
      ...(data.theme !== undefined ? { theme: data.theme as unknown as Json } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.meta_title !== undefined ? { meta_title: data.meta_title } : {}),
      ...(data.meta_description !== undefined ? { meta_description: data.meta_description } : {}),
      ...(data.og_image !== undefined ? { og_image: data.og_image } : {}),
      ...(data.og_title !== undefined ? { og_title: data.og_title } : {}),
      ...(data.og_description !== undefined ? { og_description: data.og_description } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pageId);

  if (error) return { error: error.message };

  // When a slug changes, update all other pages in the site that link to the old slug
  if (data.slug && data.siteId) {
    const { data: currentPage } = await supabase
      .from("site_pages")
      .select("slug")
      .eq("id", pageId)
      .single();

    const oldSlug = (currentPage as { slug?: string } | null)?.slug;
    if (oldSlug && oldSlug !== data.slug) {
      const { data: otherPages } = await supabase
        .from("site_pages")
        .select("id, page_data")
        .eq("site_id", data.siteId)
        .neq("id", pageId);

      if (otherPages && otherPages.length > 0) {
        const oldToken = `"/${oldSlug}"`;
        const newToken = `"/${data.slug}"`;
        const escaped = oldToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        await Promise.all(
          (otherPages as { id: string; page_data: unknown }[])
            .filter((p) => p.page_data && JSON.stringify(p.page_data).includes(oldToken))
            .map((p) => {
              const updated = JSON.parse(
                JSON.stringify(p.page_data).replace(new RegExp(escaped, "g"), newToken)
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (supabase as any)
                .from("site_pages")
                .update({ page_data: updated, updated_at: new Date().toISOString() })
                .eq("id", p.id);
            })
        );
      }
    }
  }

  if (data.siteId) revalidatePath(`/my-site/${data.siteId}`);
  return { success: true };
}

export async function setCustomDomain(siteId: string, domain: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "manager");

  // Get current site to check for existing domain + resolve owner for plan gating
  const { data: site } = await supabase
    .from("artist_sites")
    .select("user_id, custom_domain")
    .eq("id", siteId)
    .single();

  if (!site) return { error: "Site not found" };

  const { data: profile } = await supabase
    .from("profiles").select("tier_key, role").eq("id", site.user_id).single();
  const { isProPlan } = await import("@/lib/plan-gates");
  if (!isProPlan(profile?.tier_key ?? "", profile?.role)) {
    return { error: "Custom domains require a Pro plan. Upgrade to unlock." };
  }

  // Always store and match the bare domain; strip www if entered
  const cleanDomain = domain.trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
  if (!cleanDomain) return { error: "Domain is required" };

  // Basic domain format validation
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain)) {
    return { error: "Invalid domain format (e.g. willsage.com)" };
  }

  // Remove old domain (bare + www) from Vercel if different
  if (site.custom_domain && site.custom_domain !== cleanDomain) {
    await Promise.all([
      removeDomainFromProject(site.custom_domain),
      removeDomainFromProject(`www.${site.custom_domain}`),
    ]);
  }

  // Add bare domain + www to Vercel so both get a cert
  const [vercelResult] = await Promise.all([
    addDomainToProject(cleanDomain),
    addDomainToProject(`www.${cleanDomain}`),
  ]);

  // Save to DB regardless (so user can see DNS instructions even if Vercel isn't configured)
  await supabase
    .from("artist_sites")
    .update({
      custom_domain: cleanDomain,
      custom_domain_verified: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", siteId);

  revalidatePath(`/my-site/${siteId}/settings`);

  if (!vercelResult.success) {
    return { success: true, warning: `Domain saved. Vercel registration: ${vercelResult.error}` };
  }
  return { success: true };
}

export async function removeCustomDomain(siteId: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "manager");

  const { data: site } = await supabase
    .from("artist_sites")
    .select("custom_domain")
    .eq("id", siteId)
    .single();

  if (site?.custom_domain) {
    await Promise.all([
      removeDomainFromProject(site.custom_domain),
      removeDomainFromProject(`www.${site.custom_domain}`),
    ]);
  }

  await supabase
    .from("artist_sites")
    .update({ custom_domain: null, custom_domain_verified: false, updated_at: new Date().toISOString() })
    .eq("id", siteId);

  revalidatePath(`/my-site/${siteId}/settings`);
  return { success: true };
}

export async function recheckDomainStatus(siteId: string) {
  const { supabase, user } = await requireAuth();
  await requireSiteRole(supabase, siteId, user.id, "manager");

  const { data: site } = await supabase
    .from("artist_sites")
    .select("custom_domain")
    .eq("id", siteId)
    .single();

  if (!site?.custom_domain) return { error: "No custom domain set" };

  const info = await getDomainStatus(site.custom_domain);

  if (info.verified) {
    await supabase
      .from("artist_sites")
      .update({ custom_domain_verified: true, updated_at: new Date().toISOString() })
      .eq("id", siteId);
  }

  revalidatePath(`/my-site/${siteId}/settings`);
  return { verified: info.verified, status: info.status };
}

export async function togglePagePublished(pageId: string, siteId: string, publish: boolean) {
  const { supabase, user } = await requireAuth();
  await requirePageRole(supabase, pageId, user.id, "editor");
  await supabase
    .from("site_pages")
    .update({ status: publish ? "published" : "draft", updated_at: new Date().toISOString() })
    .eq("id", pageId);
  revalidatePath(`/my-site/${siteId}`);
  return { success: true };
}

export async function updatePageVisibility(
  pageId: string,
  siteId: string,
  patch: { show_in_nav?: boolean; hide_header?: boolean }
) {
  const { supabase, user } = await requireAuth();
  await requirePageRole(supabase, pageId, user.id, "editor");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("site_pages")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", pageId);
  revalidatePath(`/my-site/${siteId}`);
  return { success: true };
}

export async function deleteSitePage(pageId: string, siteId: string) {
  const { supabase, user } = await requireAuth();
  await requirePageRole(supabase, pageId, user.id, "editor");
  await supabase.from("site_pages").delete().eq("id", pageId);
  revalidatePath(`/my-site/${siteId}`);
}
