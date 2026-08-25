// Shared in-memory rate limiter for public, unauthenticated API routes
// (gate-unlock, page-gate-unlock). Same shape/tradeoffs as the one already
// inline in app/api/form-submit/route.ts: resets on cold start, not shared
// across serverless instances, but stops simple scripted flooding without
// an external dependency. Callers namespace their own keys (e.g.
// `gate:${ip}:${siteSlug}`) so different routes sharing this module don't
// collide.
const WINDOW_MS_DEFAULT = 60_000;
const timestamps = new Map<string, number[]>();

export function isRateLimited(key: string, max: number, windowMs = WINDOW_MS_DEFAULT): boolean {
  const now = Date.now();
  const recent = (timestamps.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  timestamps.set(key, recent);
  if (timestamps.size > 5000) timestamps.clear();
  return recent.length > max;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
