// Sage Studio Free vs Pro gates
// Free: 1 site, 5 pages, sagestudio.org subdomain, all features
// Pro ($5/mo): custom domain, unlimited sites, unlimited pages

export type StudioPlan = "free" | "pro";

export function isProPlan(tierKey: string): boolean {
  return tierKey === "studio_pro";
}

export function canUseCustomDomain(plan: StudioPlan): boolean {
  return plan === "pro";
}

export function canCreateSite(plan: StudioPlan, currentSiteCount: number): boolean {
  if (plan === "pro") return true;
  return currentSiteCount < 1;
}

export function canAddPage(plan: StudioPlan, currentPageCount: number): boolean {
  if (plan === "pro") return true;
  return currentPageCount < 5;
}

export function getPlanLabel(plan: StudioPlan): string {
  return plan === "pro" ? "Pro" : "Free";
}
