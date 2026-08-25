// Shared in-memory rate limiter for public, unauthenticated API routes
// (gate-unlock, page-gate-unlock). Same shape/tradeoffs as the one already
// inline in app/api/form-submit/route.ts: resets on cold start, not shared
// across serverless instances, but stops simple scripted flooding without
// an external dependency. Callers namespace their own keys (e.g.
// `gate:${ip}:${siteSlug}`) so different routes sharing this module don't
// collide.
const WINDOW_MS_DEFAULT = 60_000;
const timestamps = new Map<string, number[]>();

// Evicts only entries whose most recent hit has already aged out of any
// reasonable window, rather than clearing the whole map — a blind
// `.clear()` at a size threshold would let an attacker force it (trivial
// given getClientIp below can still be influenced by a spoofed header
// chain) and reset every other client's counter to zero at once, defeating
// the limiter for everyone at the moment it matters most.
const MAX_TRACKED_KEYS = 5000;
function evictStale(now: number) {
  if (timestamps.size <= MAX_TRACKED_KEYS) return;
  for (const [key, hits] of timestamps) {
    const newest = hits[hits.length - 1] ?? 0;
    if (now - newest > WINDOW_MS_DEFAULT) timestamps.delete(key);
  }
}

export function isRateLimited(key: string, max: number, windowMs = WINDOW_MS_DEFAULT): boolean {
  const now = Date.now();
  evictStale(now);
  const recent = (timestamps.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  timestamps.set(key, recent);
  return recent.length > max;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Best-effort client IP for rate-limit keying only (never for security
 * decisions beyond throttling). `x-forwarded-for` is a comma-separated hop
 * chain where each proxy APPENDS the address it saw; the *leftmost* entry
 * is whatever the client itself claimed and is trivially spoofable by
 * sending the header directly, while the *rightmost* entry is the one
 * Vercel's own edge appended and the client cannot control. Taking the
 * first entry (a common mistake) lets a single attacker cycle through fake
 * IPs to dodge the per-IP limit entirely.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
