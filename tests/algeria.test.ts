import { describe, expect, it } from "vitest"

import { findCommune, findWilaya, WILAYAS } from "@/lib/algeria"

describe("Algeria map data", () => {
  it("has 69 wilayas numbered 1–69 and 1,541 communes", () => {
    expect(WILAYAS.map((w) => w.code)).toEqual(Array.from({ length: 69 }, (_, i) => i + 1))
    expect(WILAYAS.reduce((n, w) => n + w.communes.length, 0)).toBe(1541)
    expect(WILAYAS.every((w) => w.communes.length > 0 && w.fr && w.ar)).toBe(true)
  })

  it("finds wilayas by code, name, accents or Arabic", () => {
    expect(findWilaya("16")?.fr).toBe("Alger")
    expect(findWilaya("16 — Alger")?.fr).toBe("Alger")
    expect(findWilaya("setif")?.fr).toBe("Sétif")
    expect(findWilaya("الجزائر")?.code).toBe(16)
    expect(findWilaya("Nowhere")).toBeNull()
  })

  it("only matches communes of the chosen wilaya", () => {
    const alger = findWilaya("Alger")!
    expect(findCommune(alger, "bab ezzouar")).toBe("Bab Ezzouar")
    expect(findCommune(alger, "Arzew")).toBeNull()
  })
})
