import "server-only"

import { randomBytes, randomUUID } from "node:crypto"

import { cookies, headers } from "next/headers"

import { hashToken } from "./auth/users"

const CART_COOKIE = "k253_cart"
const PROFILE_COOKIE = "k253_checkout"
const SID_COOKIE = "k253_sid"

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cart id from the cookie (read-only contexts may pass create=false). */
export async function readCartId() {
  const value = (await cookies()).get(CART_COOKIE)?.value
  return value && UUID.test(value) ? value : null
}

/** Only callable from Server Actions / Route Handlers. */
export async function writeCartId(id: string) {
  ;(await cookies()).set(CART_COOKIE, id, { ...base, maxAge: 60 * 60 * 24 * 60 })
}

/** Saved checkout details are keyed by SHA-256 of a random cookie token. */
export async function readProfileId() {
  const token = (await cookies()).get(PROFILE_COOKIE)?.value
  return token ? hashToken(token) : null
}

export async function ensureProfileId() {
  const jar = await cookies()
  let token = jar.get(PROFILE_COOKIE)?.value
  if (!token) {
    token = randomBytes(24).toString("base64url")
    jar.set(PROFILE_COOKIE, token, { ...base, maxAge: 60 * 60 * 24 * 30 })
  }
  return hashToken(token)
}

/** Anonymous analytics session (no personal data). */
export async function readSessionId() {
  return (await cookies()).get(SID_COOKIE)?.value ?? null
}

export async function ensureSessionId() {
  const jar = await cookies()
  let sid = jar.get(SID_COOKIE)?.value
  if (!sid) {
    sid = randomUUID()
    jar.set(SID_COOKIE, sid, { ...base, maxAge: 60 * 60 * 24 * 365 })
  }
  return sid
}

/**
 * Who is asking, for rate limits. The visitor's address from the proxy headers; when the
 * host passes none (cPanel/Passenger may not), a fingerprint of browser + language, so
 * visitors are not all counted as one person (which would lock every customer out after
 * a few orders).
 */
export async function clientIp() {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || h.get("cf-connecting-ip") || h.get("true-client-ip")
  if (ip) return ip
  return "anon:" + hashToken(`${h.get("user-agent") ?? ""}|${h.get("accept-language") ?? ""}`).slice(0, 16)
}
