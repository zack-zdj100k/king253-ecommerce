import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { orderItems, products } from "@/server/db/schema"
import { adjustPhysicalStock } from "@/server/inventory"
import { createOrder } from "@/server/orders/create"
import { changeOrderStatus } from "@/server/orders/manage"
import { saveProduct } from "@/server/products-admin"
import { recordReturn } from "@/server/returns"
import { customer, key, resetDb, seedDelivery, seedProduct, stockOf, testDb } from "./support/db"

const admin = { userId: null, label: "Admin" }

beforeEach(async () => {
  await resetDb()
})

describe("Concurrency", () => {
  it("25 buyers at once for 10 units: exactly 10 orders, stock exact, nobody oversold", async () => {
    const { wilaya } = await seedDelivery()
    const p = await seedProduct({ slug: "drop", price: 5000, variants: [{ size: "M", color: "Black", physical: 10 }] })
    const attempts = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) =>
        createOrder(testDb, { customer: customer({ wilaya, phone: `0550001${String(i).padStart(3, "0")}` }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() })
      )
    )
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(10)
    expect(await stockOf(p.variants[0].id)).toEqual({ physical: 10, reserved: 10, available: 0 })
  })

  it("cancel and deliver racing on one order: exactly one wins, stock matches the winner", async () => {
    const { wilaya } = await seedDelivery()
    const p = await seedProduct({ slug: "race", price: 5000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: p.variants[0].id, quantity: 2 }], idempotencyKey: key() })
    await changeOrderStatus(testDb, { orderId: o.id, to: "confirmed", actor: admin })
    const r = await Promise.allSettled([
      changeOrderStatus(testDb, { orderId: o.id, to: "delivered", actor: admin }),
      changeOrderStatus(testDb, { orderId: o.id, to: "cancelled", actor: admin }),
    ])
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1)
    const s = await stockOf(p.variants[0].id)
    expect(s.reserved).toBe(0)
    expect([5, 3]).toContain(s.physical) // cancelled: 5, delivered: 3 — never anything else
  })

  it("the same item returned twice at the same moment: one return, stock +1 only", async () => {
    const { wilaya } = await seedDelivery()
    const p = await seedProduct({ slug: "ret", price: 5000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    await changeOrderStatus(testDb, { orderId: o.id, to: "confirmed", actor: admin })
    await changeOrderStatus(testDb, { orderId: o.id, to: "delivered", actor: admin })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    const r = await Promise.allSettled([
      recordReturn(testDb, { orderId: o.id, returned: [{ orderItemId: item.id, quantity: 1 }] }, admin),
      recordReturn(testDb, { orderId: o.id, returned: [{ orderItemId: item.id, quantity: 1 }] }, admin),
    ])
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1)
    expect(await stockOf(p.variants[0].id)).toMatchObject({ physical: 5, reserved: 0 }) // 5 − 1 delivered + 1 returned
  })

  it("two admins counting the same shelf at once: no deadlock, totals stay equal to the sum of shops", async () => {
    const { shop, variants } = await seedProduct({ slug: "count", price: 5000, variants: [{ size: "M", color: "Black", physical: 4 }] })
    const run = (n: number) => testDb.transaction((tx) => adjustPhysicalStock(tx, { variantId: variants[0].id, storeId: shop.id, newPhysical: n, reason: "Count", actorUserId: null as never }))
    const r = await Promise.allSettled([run(7), run(9), run(6), run(8)])
    expect(r.every((x) => x.status === "fulfilled")).toBe(true)
    const s = await stockOf(variants[0].id)
    expect([6, 7, 8, 9]).toContain(s.physical)
  })

  it("two admins saving the same product at once: both succeed, the record stays valid", async () => {
    const p = await saveProduct(testDb, null, { name: "Hoodie", status: "published", price: 5000, gender: "men", featured: false }, admin)
    const edit = (name: string, price: number) => saveProduct(testDb, p.id, { name, status: "published", price, gender: "men", featured: false }, admin)
    const r = await Promise.allSettled([edit("Hoodie A", 5100), edit("Hoodie B", 5200), edit("Hoodie C", 5300)])
    expect(r.every((x) => x.status === "fulfilled")).toBe(true)
    const [row] = await testDb.select().from(products).where(eq(products.id, p.id))
    expect(["Hoodie A", "Hoodie B", "Hoodie C"]).toContain(row.name)
    expect(row.price).toBe({ "Hoodie A": 5100, "Hoodie B": 5200, "Hoodie C": 5300 }[row.name as string])
  })
})
