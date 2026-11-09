import { beforeEach, describe, expect, it } from "vitest"

import { createOrder } from "@/server/orders/create"
import { getOverview } from "@/server/overview"
import { recordReturn } from "@/server/returns"
import { customer, deliver, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

const admin = { userId: null, label: "Admin" }

beforeEach(async () => {
  await resetDb()
})

describe("Overview", () => {
  it("counts real orders per status, revenue of delivered orders, and drops fully returned ones", async () => {
    const { wilaya } = await seedDelivery()
    const tee = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 10 }] })
    const buy = (n = 1) => createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: tee.variants[0].id, quantity: n }], referralSource: "tiktok", idempotencyKey: key() })
    const a = await buy(2)
    const b = await buy(1)
    await buy(1)
    await deliver(a.id, admin)
    await deliver(b.id, admin)

    let o = await getOverview(testDb, { storeId: null, lowStockThreshold: 3 })
    expect(o.kpis).toMatchObject({ pending: 1, confirmed: 0, delivered: 2, topSource: { label: "TikTok" } })
    expect(o.revenue.value).toBe(9000)
    expect(o.revenue.series.at(-1)?.value).toBe(9000)
    expect(o.orders.value).toBe(3)
    expect(o.categories.periods[0].total).toBe(9000)
    expect(o.seasonality[0].values.reduce((s, v) => s + v, 0)).toBe(9000)

    const { orderItems } = await import("@/server/db/schema")
    const { eq } = await import("drizzle-orm")
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, b.id))
    await recordReturn(testDb, { orderId: b.id, returned: [{ orderItemId: item.id, quantity: 1 }] }, admin)
    o = await getOverview(testDb, { storeId: tee.shop.id, lowStockThreshold: 3 })
    expect(o.revenue.value).toBe(6000)
    expect(o.kpis.delivered).toBe(1)
    expect(o.kpis.journal).toMatchObject({ count: 1, refunded: 3000 })
  })
})
