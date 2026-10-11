import { describe, expect, it } from "vitest"

import { shopClosure } from "@/lib/closure"
import { settingsSchema } from "@/server/settings"

const now = new Date("2026-10-11T12:00:00Z")
const base = { shopClosed: true, closedFrom: "", closedUntil: "" }

describe("Shop closure (vacation mode)", () => {
  it("is open when the closure is switched off, whatever the dates", () => {
    expect(shopClosure({ ...base, shopClosed: false, closedFrom: "2026-10-01T00:00:00Z", closedUntil: "2026-12-01T00:00:00Z" }, now)).toEqual({ state: "open" })
  })

  it("closes right away with no dates, until the admin reopens", () => {
    expect(shopClosure(base, now)).toEqual({ state: "closed", until: null })
  })

  it("closes now and reopens by itself at the end date", () => {
    const until = "2026-10-14T09:00:00Z"
    expect(shopClosure({ ...base, closedUntil: until }, now)).toEqual({ state: "closed", until: new Date(until) })
    expect(shopClosure({ ...base, closedUntil: until }, new Date("2026-10-14T09:00:00Z"))).toEqual({ state: "open" })
  })

  it("is only scheduled before the start date", () => {
    const from = "2026-10-20T08:00:00Z"
    const until = "2026-10-27T08:00:00Z"
    expect(shopClosure({ ...base, closedFrom: from, closedUntil: until }, now)).toEqual({ state: "scheduled", from: new Date(from), until: new Date(until) })
    expect(shopClosure({ ...base, closedFrom: from, closedUntil: until }, new Date("2026-10-21T00:00:00Z")).state).toBe("closed")
  })

  it("defaults to open and rejects invalid dates in settings", () => {
    const defaults = settingsSchema.parse({})
    expect(shopClosure(defaults, now)).toEqual({ state: "open" })
    expect(settingsSchema.shape.closedUntil.safeParse("not a date").success).toBe(false)
  })
})
