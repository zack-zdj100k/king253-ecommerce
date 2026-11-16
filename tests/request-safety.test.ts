import { describe, expect, it } from "vitest"

import { pickClientIp, safeLocalPath } from "@/lib/request-safety"

const from = (h: Record<string, string>) => (name: string) => h[name] ?? null

describe("pickClientIp", () => {
  it("takes the address our proxy added (last X-Forwarded-For entry), not the one the visitor typed", () => {
    expect(pickClientIp(from({ "x-forwarded-for": "1.2.3.4, 105.98.10.20" }))).toBe("105.98.10.20")
  })
  it("a forged first entry cannot change the counted address", () => {
    const a = pickClientIp(from({ "x-forwarded-for": "9.9.9.1, 105.98.10.20" }))
    const b = pickClientIp(from({ "x-forwarded-for": "9.9.9.2, 105.98.10.20" }))
    expect(a).toBe(b)
  })
  it("ignores Cloudflare/Akamai headers the visitor can set", () => {
    expect(pickClientIp(from({ "cf-connecting-ip": "6.6.6.6", "true-client-ip": "7.7.7.7" }))).toBeNull()
  })
  it("falls back to X-Real-IP and rejects junk", () => {
    expect(pickClientIp(from({ "x-real-ip": "41.200.1.2" }))).toBe("41.200.1.2")
    expect(pickClientIp(from({ "x-forwarded-for": "<script>", "x-real-ip": "nope" }))).toBeNull()
  })
  it("accepts IPv6", () => {
    expect(pickClientIp(from({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1")
  })
})

describe("safeLocalPath", () => {
  it.each(["/account", "/admin/orders?status=new", "/product/hoodie#reviews", "/ar/clothes"])("keeps %s", (p) => {
    expect(safeLocalPath(p)).toBe(p)
  })
  it.each([
    "//evil.example",
    "/\\evil.example",
    "/%5Cevil.example",
    "/%2F%2Fevil.example",
    "/\tevil",
    "https://evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
    null,
    42,
  ])("rejects %s", (p) => {
    expect(safeLocalPath(p)).toBeNull()
  })
})
