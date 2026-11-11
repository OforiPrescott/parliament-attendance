/**
 * Small in-memory sliding-window limiter for the login endpoint.
 * Per-account lockout (in the database) is the primary control; this adds
 * protection against spraying many usernames from one address. For a
 * multi-instance deployment, move this to Redis or the reverse proxy.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return list.length <= limit;
}
