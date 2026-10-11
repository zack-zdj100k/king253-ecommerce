import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { orderItems, products, users } from "@/server/db/schema"
import { getProductPage, listProducts } from "@/server/catalog"
import { createOrder } from "@/server/orders/create"
import { offerOf } from "@/server/pricing"
import { saveColour } from "@/server/products-admin"

import { customer, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

let actor: { userId: string; label: string }

beforeEach(async () => {
  await resetDb()
  const [u] = await testDb.insert(users).values({ email: "admin@test.local", name: "Test admin", passwordHash: "x", role: "admin" }).returning()
  actor = { userId: u.id, label: "Test admin" }
})

describe("Pricing rule", () => {
  const product = { price: 5000, salePrice: 4697 }

  it("a colour without its own price uses the product price and promo", () => {
    expect(offerOf(product, { priceOverride: null, salePriceOverride: null })).toEqual({ price: 4697, compareAt: 5000 })
    expect(offerOf({ price: 5000, salePrice: null }, { priceOverride: null })).toEqual({ price: 5000, compareAt: null })
  })

  it("a colour with its own price uses only its own promo", () => {
    expect(offerOf(product, { priceOverride: 6500, salePriceOverride: null })).toEqual({ price: 6500, compareAt: null })
    expect(offerOf(product, { priceOverride: 6500, salePriceOverride: 5900 })).toEqual({ price: 5900, compareAt: 6500 })
  })

  it("a colour with its own price is left out of the product promo, even at the same price", () => {
    expect(offerOf(product, { priceOverride: 5000, salePriceOverride: null })).toEqual({ price: 5000, compareAt: null })
  })

  it("a colour promo on the product price", () => {
    expect(offerOf(product, { priceOverride: null, salePriceOverride: 4000 })).toEqual({ price: 4000, compareAt: 5000 })
  })
})

describe("Cards, product page and orders", () => {
  async function setup() {
    const p = await seedProduct({
      slug: "tee",
      price: 5000,
      variants: [
        { size: "M", color: "Black", physical: 5 },
        { size: "M", color: "Blue", physical: 5 },
      ],
    })
    await testDb.update(products).set({ salePrice: 4697 }).where(eq(products.id, p.product.id))
    return p
  }

  it("the card shows the product's regular price with its promo", async () => {
    const p = await setup()
    await saveColour(testDb, p.product.id, "Blue", { name: "Blue", hex: "", price: "6500", promo: "" }, actor)
    const [card] = (await listProducts(testDb, {})).products
    expect(card).toMatchObject({ price: 4697, compareAt: 5000, promo: true })
  })

  it("flags a card as promo when only one colour is on promo", async () => {
    const p = await setup()
    await testDb.update(products).set({ salePrice: null }).where(eq(products.id, p.product.id))
    await saveColour(testDb, p.product.id, "Blue", { name: "Blue", hex: "", price: "6500", promo: "5900" }, actor)
    const [card] = (await listProducts(testDb, {})).products
    expect(card).toMatchObject({ price: 5000, compareAt: null, promo: true })
  })

  it("each colour shows and charges its own price and promo", async () => {
    const p = await setup()
    await saveColour(testDb, p.product.id, "Blue", { name: "Blue", hex: "", price: "6500", promo: "5900" }, actor)
    const page = await getProductPage(testDb, "tee")
    const byColour = Object.fromEntries(page!.variants.map((v) => [v.color, { price: v.price, compareAt: v.compareAt }]))
    expect(byColour).toEqual({ Black: { price: 4697, compareAt: 5000 }, Blue: { price: 5900, compareAt: 6500 } })

    const { wilaya } = await seedDelivery()
    const blue = p.variants.find((v) => v.color === "Blue")!
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blue.id, quantity: 2 }], idempotencyKey: key() })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    expect(item).toMatchObject({ unitPrice: 5900, lineTotal: 11800 })
  })

  it("refuses a colour promo that is not lower than its regular price", async () => {
    const p = await setup()
    await expect(saveColour(testDb, p.product.id, "Blue", { name: "Blue", hex: "", price: "6500", promo: "7000" }, actor)).rejects.toThrow(/lower than the regular price \(6500 DA\)/)
    await expect(saveColour(testDb, p.product.id, "Blue", { name: "Blue", hex: "", price: "", promo: "5000" }, actor)).rejects.toThrow(/5000 DA/)
  })
})
