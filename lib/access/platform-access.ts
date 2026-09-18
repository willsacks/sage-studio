export type PlatformRole = "member" | "moderator" | "admin" | "manager" | "customer_success";

/** Any of the three roles that can see Platform Admin at all (vs. a plain
 * member, who can't). */
export function isPlatformStaff(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager" || role === "customer_success";
}

/** Full, non-destructive control of the platform: metrics, AI settings,
 * pricing/discounts, user lookup. Everything except destructive actions
 * (only isPlatformAdmin gets those) — today that's things like permanently
 * deleting a user account, which this codebase doesn't expose from the
 * admin area yet, but any such action added later should gate on
 * isPlatformAdmin, not this. */
export function canManagePlatform(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

/** Read-only account lookup for support — a user's profile, sites, and
 * courses, to help answer "what's going on with my account" without any
 * ability to change platform settings or pricing. */
export function canViewUserAccounts(role: string | null | undefined): boolean {
  return isPlatformStaff(role);
}

/** Reserved for genuinely destructive admin actions. Only real admins, not
 * managers — see canManagePlatform's note. */
export function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}
