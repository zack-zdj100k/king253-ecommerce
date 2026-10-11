import { beforeEach, describe, expect, it } from "vitest"

import { socialStats } from "@/server/admin/social"
import { createUser } from "@/server/auth/users"
import { createOrder } from "@/server/orders/create"
import { changeOrderStatus } from "@/server/orders/manage"

import { customer, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

beforeEach(async () => {
  await resetDb()
})

describe("Social media statistics", () => {
  it("counts sign-ups per source and what those customers bought", async () => {
    const mk = (n: number, source: string | null) => createUser(testDb, { email: `u${n}@test.local`, name: `User ${n}`, password: "TestPass123", role: "customer", referralSource: source })
    const tiktok = await mk(1, "tiktok")
    await mk(2, "tiktok")
    await mk(3, "instagram")
    await mk(4, null)
    await createUser(testDb, { email: "boss@test.local", name: "Boss", password: "TestPass123", role: "admin" })

    await seedDelivery()
    const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() }, { userId: tiktok.id })
    await changeOrderStatus(testDb, { orderId: o.id, to: "delivered", actor: { userId: null, label: "Admin" } })

    const s = await socialStats(testDb)
    expect(s.answered).toBe(3)
    expect(s.notAsked).toBe(1)
    expect(s.top).toMatchObject({ key: "tiktok", accounts: 2, buyers: 1, orders: 1, revenue: 3000 })
    expect(s.sources.find((x) => x.key === "instagram")).toMatchObject({ accounts: 1, buyers: 0 })
    expect(s.sources).toHaveLength(5)
  })
})
