import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { deliveryRates, orders, productStores, stockMovements, storeStock, users } from "@/server/db/schema"
import { adjustPhysicalStock, setProductStores, shopsThatCanFulfil } from "@/server/inventory"
import { createOrder } from "@/server/orders/create"
import { createVariant, saveProduct } from "@/server/products-admin"
import { saveDesk } from "@/server/shipping"
import { saveStore } from "@/server/stores"
import { customer, key, resetDb, seedDelivery, seedProduct, stockOf, testDb, testShop } from "./support/db"

let actor: { userId: string; label: string }

async function shopStock(variantId: string, storeId: number) {
  const [row] = await testDb.select().from(storeStock).where(eq(storeStock.variantId, variantId)).then((r) => r.filter((x) => x.storeId === storeId))
  return row ? { physical: row.physical, reserved: row.reserved } : null
}

beforeEach(async () => {
  await resetDb()
  const [u] = await testDb.insert(users).values({ email: "admin@test.local", name: "Test admin", passwordHash: "x", role: "admin" }).returning()
  actor = { userId: u.id, label: "Test admin" }
})

describe("Stock per shop", () => {
  it("a new shop is offered to new products; opening stock goes to the chosen shop; totals are the sum", async () => {
    const a = await testShop("shop-a")
    const b = await testShop("shop-b")
    const p = await saveProduct(
      testDb,
      null,
      { name: "Hoodie", status: "draft", price: 5000, gender: "men", featured: false },
      actor
    )
    const shops = await testDb.select().from(productStores).where(eq(productStores.productId, p.id))
    expect(shops.map((s) => s.storeId).sort()).toEqual([a.id, b.id].sort())

    const v = await createVariant(testDb, p.id, { sku: "HOOD-M", size: "M", color: "Black", initialStock: 5, initialStoreId: b.id }, actor)
    expect(await shopStock(v!.id, a.id)).toEqual({ physical: 0, reserved: 0 })
    expect(await shopStock(v!.id, b.id)).toEqual({ physical: 5, reserved: 0 })
    await testDb.transaction((tx) => adjustPhysicalStock(tx, { variantId: v!.id, storeId: a.id, newPhysical: 3, reason: "Count", actorUserId: actor.userId }))
    expect(await stockOf(v!.id)).toEqual({ physical: 8, reserved: 0, available: 8 })
    const [move] = (await testDb.select().from(stockMovements).where(eq(stockMovements.storeId, a.id))).slice(-1)
    expect(move).toMatchObject({ physicalBefore: 0, physicalAfter: 3 })
  })

  it("switching a shop off for a product keeps its stock but stops selling it; on again sells it", async () => {
    const { product, variants, shop } = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 2 }] })
    const line = [{ variantId: variants[0].id, quantity: 1 }]
    expect((await shopsThatCanFulfil(testDb, line)).map((s) => s.id)).toEqual([shop.id])

    await testDb.transaction((tx) => setProductStores(tx, product.id, []))
    expect(await shopStock(variants[0].id, shop.id)).toEqual({ physical: 2, reserved: 0 })
    expect(await shopsThatCanFulfil(testDb, line)).toEqual([])
    const [row] = await testDb.select().from(productStores).where(eq(productStores.productId, product.id))
    expect(row.active).toBe(false)

    await testDb.transaction((tx) => setProductStores(tx, product.id, [shop.id]))
    expect((await shopsThatCanFulfil(testDb, line)).map((s) => s.id)).toEqual([shop.id])
  })

  it("checkout ships from a shop that has the whole order, reserves there, and never splits", async () => {
    const { wilaya } = await seedDelivery()
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 1 }], shopSlug: "shop-a" })
    const cap = await seedProduct({ slug: "cap", price: 1000, variants: [{ size: "U", color: "Black", physical: 4 }], shopSlug: "shop-b" })
    const capM = cap.variants[0]
    const teeM = tee.variants[0]

    // Only shop B has the cap → the order ships from B.
    const o1 = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: capM.id, quantity: 2 }], idempotencyKey: key() })
    expect(o1.storeId).toBe(cap.shop.id)
    expect(await shopStock(capM.id, cap.shop.id)).toEqual({ physical: 4, reserved: 2 })

    // Tee (A) + cap (B): no single shop has both → refused, nothing reserved.
    expect(await shopsThatCanFulfil(testDb, [{ variantId: teeM.id, quantity: 1 }, { variantId: capM.id, quantity: 1 }])).toEqual([])
    await expect(
      createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: teeM.id, quantity: 1 }, { variantId: capM.id, quantity: 1 }], idempotencyKey: key() })
    ).rejects.toThrow(/No single shop/)
    expect(await shopStock(teeM.id, tee.shop.id)).toEqual({ physical: 1, reserved: 0 })

    // Choosing a shop that lacks the item is refused.
    await expect(
      createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: capM.id, quantity: 1 }], storeId: tee.shop.id, idempotencyKey: key() })
    ).rejects.toThrow(/shop you chose/)
    expect(await testDb.select().from(orders)).toHaveLength(1)
  })

  it("an inactive shop is never offered", async () => {
    const { wilaya } = await seedDelivery()
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    await saveStore(testDb, tee.shop.id, { ...tee.shop, active: false, latitude: "", longitude: "" }, actor)
    await expect(
      createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: tee.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    ).rejects.toThrow(/no longer available|Only|No single shop/)
  })
})

describe("Checkout delivery choice", () => {
  beforeEach(async () => {
    await resetDb()
  })

  it("stop desk: the desk must belong to the chosen shop; its price and name are kept on the order", async () => {
    const { wilaya } = await seedDelivery(600)
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    const desk = await saveDesk(testDb, tee.shop.id, null, { wilayaCode: 16, commune: "Bab Ezzouar", name: "Desk BZ", address: "1 rue", deskPrice: "350" }, { userId: null, label: "t" })
    const order = await createOrder(testDb, {
      customer: customer({ wilaya, city: "Bab Ezzouar" }),
      lines: [{ variantId: tee.variants[0].id, quantity: 1 }],
      delivery: { type: "desk", deskId: desk.id },
      idempotencyKey: key(),
    })
    expect(order).toMatchObject({ deliveryType: "desk", deliveryDeskId: desk.id, deskName: "Desk BZ", deliveryFee: 350, total: 2350 })
    await expect(
      createOrder(testDb, {
        customer: customer({ wilaya, city: "Bab Ezzouar" }),
        lines: [{ variantId: tee.variants[0].id, quantity: 1 }],
        delivery: { type: "desk", deskId: 999999 },
        idempotencyKey: key(),
      })
    ).rejects.toThrow(/check the highlighted/i)
  })

  it("stop desk with no listed desk: uses the wilaya's desk price, address confirmed by phone", async () => {
    const { wilaya } = await seedDelivery(600)
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    // Wilaya without a desk price → Stop desk not offered.
    await expect(
      createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: tee.variants[0].id, quantity: 1 }], delivery: { type: "desk" }, idempotencyKey: key() })
    ).rejects.toThrow(/no longer has everything|no stop desk/i)
    await testDb.update(deliveryRates).set({ deskPrice: 480 }).where(eq(deliveryRates.storeId, tee.shop.id))
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: tee.variants[0].id, quantity: 1 }], delivery: { type: "desk" }, idempotencyKey: key() })
    expect(order).toMatchObject({ deliveryType: "desk", deliveryDeskId: null, deskName: "ZR Express", deliveryFee: 480, total: 2480 })
    expect(order.deskAddress).toMatch(/téléphone/)
  })

  it("an order ships with an open one only from the same shop and the same delivery", async () => {
    const { wilaya } = await seedDelivery(600)
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const first = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: tee.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    const second = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: tee.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    expect([first.deliveryFee, second.deliveryFee, second.shipsWithOrderId]).toEqual([600, 0, first.id])
  })
})
