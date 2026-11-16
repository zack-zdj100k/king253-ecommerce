/**
 * Request helpers that must not trust what the browser sends. Pure functions, so they are unit-tested.
 */

/**
 * The visitor's address for rate limits.
 *
 * X-Forwarded-For is a list: "<what the client wrote>, …, <what our proxy saw>". Only the LAST entry is
 * added by the server in front of the app; anything before it can be typed by the visitor. Taking the
 * first entry let anyone pick a new "address" on every request and skip every limit.
 * CF-Connecting-IP / True-Client-IP are ignored: the site is not behind Cloudflare/Akamai, so they are
 * always visitor-supplied.
 */
export function pickClientIp(get: (name: string) => string | null | undefined): string | null {
  const forwarded = get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last && isIp(last)) return last
  }
  const real = get("x-real-ip")?.trim()
  if (real && isIp(real)) return real
  return null
}

function isIp(s: string) {
  return s.length <= 45 && (/^\d{1,3}(\.\d{1,3}){3}$/.test(s) || /^[0-9a-f:]+$/i.test(s))
}

/**
 * A same-site path to send the visitor to after signing in (or switching language).
 * Rejects "//evil", "/\evil", "/%5Cevil", control characters and anything the browser would resolve to
 * another site: the path is resolved against a dummy origin and must stay on it.
 */
export function safeLocalPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 500) return null
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }
  if (/^\/[\\/]/.test(decoded) || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null
  try {
    const url = new URL(value, "https://same.invalid")
    if (url.origin !== "https://same.invalid") return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}
