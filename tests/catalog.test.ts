import { beforeEach, describe, expect, it } from "vitest"

import { addToCart, getCartLines } from "@/server/cart"
import { carts } from "@/server/db/schema"
import { getAbandonedCarts } from "@/server/analytics"
import { getCatalogFacets, getProductPage, getRelatedProducts, listProducts } from "@/server/catalog"
import { createOrder } from "@/server/orders/create"
import { eq, sql } from "drizzle-orm"

import { customer, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

beforeEach(async () => {
  await resetDb()
})

describe("Catalog search & filters (database side)", () => {
  it("filters by size, availability, price and search; hides drafts", async () => {
    await seedProduct({ slug: "hoodie-black", price: 6000, variants: [{ size: "M", color: "Black", physical: 3 }, { size: "L", color: "Black", physical: 0 }] })
    await seedProduct({ slug: "tee-white", price: 2500, variants: [{ size: "L", color: "White", physical: 2 }] })
    await seedProduct({ slug: "secret", price: 1000, status: "draft", variants: [{ size: "M", color: "Red", physical: 9 }] })

    const all = await listProducts(testDb)
    expect(all.products.map((p) => p.slug).sort()).toEqual(["hoodie-black", "tee-white"])

    const sizeL = await listProducts(testDb, { size: "L", inStock: true })
    expect(sizeL.products.map((p) => p.slug)).toEqual(["tee-white"]) // hoodie L has 0 available

    const cheap = await listProducts(testDb, { maxPrice: 3000, sort: "price_asc" })
    expect(cheap.products.map((p) => p.slug)).toEqual(["tee-white"])

    const search = await listProducts(testDb, { q: "hoodie" })
    expect(search.products).toHaveLength(1)
    expect(search.products[0].available).toBe(3)

    const facets = await getCatalogFacets(testDb)
    expect(facets.sizes).toEqual(["M", "L"])
  })

  it("product page derives availability per variant", async () => {
    const { wilaya } = await seedDelivery()
    const p = await seedProduct({ slug: "page", price: 4000, variants: [{ size: "S", color: "Black", physical: 5, reserved: 5 }, { size: "M", color: "Black", physical: 4 }] })
    await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: p.variants[1].id, quantity: 1 }], idempotencyKey: key() })
    const page = await getProductPage(testDb, "page")
    expect(page!.variants.map((v) => [v.size, v.available])).toEqual([["S", 0], ["M", 3]])
    const related = await getRelatedProducts(testDb, { ...page!.product, tags: [] })
    expect(related).toEqual([])
  })
})

describe("TEST 10 — Abandoned cart", () => {
  it("a cart left after starting checkout shows up with its value; adding to a bag never reserves", async () => {
    const p = await seedProduct({ slug: "abandon", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const [cart] = await testDb.insert(carts).values({}).returning()
    await addToCart(testDb, cart.id, p.variants[0].id, 2)
    expect((await getCartLines(testDb, cart.id))[0]).toMatchObject({ quantity: 2, available: 5, issue: null })

    // Bag does not reserve stock.
    const v = await testDb.query.productVariants.findFirst({ where: (t, { eq }) => eq(t.id, p.variants[0].id) })
    expect(v!.reserved).toBe(0)

    await testDb.update(carts).set({ checkoutStartedAt: new Date(), lastActivityAt: sql`now() - interval '5 hours'` }).where(eq(carts.id, cart.id))
    const report = await getAbandonedCarts(testDb, { hours: 2 })
    expect(report.count).toBe(1)
    expect(report.estimatedValue).toBe(6000)
    expect(report.carts[0].checkoutStartedAt).not.toBeNull()
  })

  it("cannot put more in the bag than is available", async () => {
    const p = await seedProduct({ slug: "few", price: 3000, variants: [{ size: "M", color: "Black", physical: 2 }] })
    const [cart] = await testDb.insert(carts).values({}).returning()
    await expect(addToCart(testDb, cart.id, p.variants[0].id, 3)).rejects.toThrow(/Only 2 left/)
  })
})
