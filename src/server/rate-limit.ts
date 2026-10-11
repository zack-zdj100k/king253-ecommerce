/**
 * Small in-memory sliding-window limiter. Good for a single server process;
 * swap for Redis/Upstash when running several instances.
 */
type Bucket = { hits: number[] }
const holder = globalThis as unknown as { __k253Rate?: Map<string, Bucket> }
const store: Map<string, Bucket> = (holder.__k253Rate ??= new Map<string, Bucket>())

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const bucket = store.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
  if (bucket.hits.length >= limit) {
    store.set(key, bucket)
    return { ok: false, retryAfterMs: windowMs - (now - bucket.hits[0]) }
  }
  bucket.hits.push(now)
  store.set(key, bucket)
  if (store.size > 10_000) {
    for (const [k, b] of store) if (!b.hits.some((t) => now - t < windowMs)) store.delete(k)
  }
  return { ok: true, retryAfterMs: 0 }
}
