import { beforeEach, describe, expect, it } from "vitest"

import { stockMovements, users } from "@/server/db/schema"
import { createOrder } from "@/server/orders/create"
import { createVariant, deleteVariant, saveProduct, updateVariant } from "@/server/products-admin"
import { saveSettings, getSettings } from "@/server/settings"

import { customer, key, resetDb, seedDelivery, seedProduct, stockOf, testDb } from "./support/db"

let actor: { userId: string; label: string }

beforeEach(async () => {
  await resetDb()
  const [u] = await testDb.insert(users).values({ email: "admin@test.local", name: "Test admin", passwordHash: "x", role: "admin" }).returning()
  actor = { userId: u.id, label: "Test admin" }
})

const base = { gender: "men" as const, featured: false }

describe("Product admin", () => {
  it("refuses to publish without a price and validates sale price", async () => {
    await expect(saveProduct(testDb, null, { ...base, name: "No price", status: "published" }, actor)).rejects.toThrow(/price before publishing/)
    await expect(saveProduct(testDb, null, { ...base, name: "Bad sale", status: "draft", price: 1000, salePrice: 2000 }, actor)).rejects.toThrow(/lower than the regular/)
    const p = await saveProduct(testDb, null, { ...base, name: "Graphic Hoodie", status: "published", price: 6500 }, actor)
    expect(p.slug).toBe("graphic-hoodie")
    expect(p.publishedAt).not.toBeNull()
    const second = await saveProduct(testDb, null, { ...base, name: "Graphic Hoodie", status: "draft", price: 6500 }, actor)
    expect(second.slug).toBe("graphic-hoodie-2")
  })

  it("opening stock goes through the ledger; duplicate SKU is a friendly error", async () => {
    const p = await saveProduct(testDb, null, { ...base, name: "Tee", status: "draft", price: 2000 }, actor)
    const v = await createVariant(testDb, p.id, { sku: "king-tee-blk-m-001", size: "M", color: "Black", initialStock: 8 }, actor)
    expect(v!.sku).toBe("KING-TEE-BLK-M-001")
    expect(await stockOf(v!.id)).toEqual({ physical: 8, reserved: 0, available: 8 })
    const [move] = await testDb.select().from(stockMovements)
    expect(move).toMatchObject({ type: "adjustment", physicalBefore: 0, physicalAfter: 8, reason: "Opening stock" })
    await expect(createVariant(testDb, p.id, { sku: "KING-TEE-BLK-M-001", size: "L", color: "Black" }, actor)).rejects.toThrow(/SKU is already used/)
  })

  it("variants reserved by open orders cannot be deleted; sold variants keep their size", async () => {
    const { wilaya } = await seedDelivery()
    const prod = await seedProduct({ slug: "ordered", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const v = prod.variants[0]
    await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: v.id, quantity: 1 }], idempotencyKey: key() })
    await expect(deleteVariant(testDb, v.id, actor)).rejects.toThrow(/reserved for open orders/)
    await expect(updateVariant(testDb, v.id, { sku: v.sku, size: "XL", color: "Black" }, actor)).rejects.toThrow(/has orders/)
    const off = await updateVariant(testDb, v.id, { sku: v.sku, size: "M", color: "Black", active: false }, actor)
    expect(off!.active).toBe(false)
  })
})

describe("Settings", () => {
  it("custom order prefix is used for new order numbers", async () => {
    await saveSettings(testDb, { orderPrefix: "K253" })
    expect((await getSettings(testDb)).orderPrefix).toBe("K253")
    const { wilaya } = await seedDelivery()
    const prod = await seedProduct({ slug: "pref", price: 1000, variants: [{ size: "M", color: "Black", physical: 2 }] })
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: prod.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    expect(order.number).toMatch(/^K253-\d{8}-001$/)
  })
})

describe("Admin reports (subquery correctness)", () => {
  it("order list counts items and customer history lists products", async () => {
    const { listOrders, getCustomerDetail, listCustomers } = await import("@/server/admin/queries")
    const { wilaya } = await seedDelivery()
    const prod = await seedProduct({ slug: "report", price: 2000, variants: [{ size: "M", color: "Black", physical: 9 }] })
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: prod.variants[0].id, quantity: 3 }], idempotencyKey: key() })

    const list = await listOrders(testDb, {})
    expect(list.rows[0].items).toBe(3)

    const customers = await listCustomers(testDb, {})
    expect(customers.rows[0].stats.orders).toBe(1)

    const detail = await getCustomerDetail(testDb, order.customerId!)
    expect(detail!.orders[0].items).toEqual([{ name: "Product report", size: "M", color: "Black", quantity: 3 }])
  })
})
