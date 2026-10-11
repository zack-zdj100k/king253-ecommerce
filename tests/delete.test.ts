import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { auditLogs, cartItems, carts, customers, orderItems, orders, products, stores, users } from "@/server/db/schema"
import { deleteCart } from "@/server/cart"
import { deleteCustomer } from "@/server/customers"
import { createOrder } from "@/server/orders/create"
import { changeOrderStatus, deleteOrder } from "@/server/orders/manage"
import { deleteProduct, deleteVariant } from "@/server/products-admin"
import { approveReturn, createReturnRequest, deleteReturn } from "@/server/returns"
import { getSettings } from "@/server/settings"
import { deleteStore, listStores, saveStore } from "@/server/stores"

import { customer, key, resetDb, seedDelivery, seedProduct, stockOf, testDb } from "./support/db"

let actor: { userId: string; label: string }

beforeEach(async () => {
  await resetDb()
  const [u] = await testDb.insert(users).values({ email: "admin@test.local", name: "Test admin", passwordHash: "x", role: "admin" }).returning()
  actor = { userId: u.id, label: "Test admin" }
})

async function orderOf(variantId: string, quantity = 1, phone = "0550000001") {
  const { wilaya } = await seedDelivery()
  return createOrder(testDb, { customer: customer({ wilaya, phone }), lines: [{ variantId, quantity }], idempotencyKey: key() })
}

describe("Checkout delivery", () => {
  it("uses the typed wilaya and the single delivery fee from settings", async () => {
    const p = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    await seedDelivery(700)
    const order = await createOrder(testDb, {
      customer: customer({ wilaya: "  Oran ", city: "Bir El Djir", address: "12 Rue des Palmiers" }),
      lines: [{ variantId: p.variants[0].id, quantity: 1 }],
      idempotencyKey: key(),
    })
    expect(order).toMatchObject({ wilayaName: "Oran", city: "Bir El Djir", deliveryFee: 700, total: 2700, estimatedDays: "2–3 days" })
  })

  it("defaults to a 0 DA fee (confirmed by phone) and requires a wilaya", async () => {
    expect((await getSettings(testDb)).deliveryFee).toBe(0)
    const p = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    await expect(
      createOrder(testDb, { customer: customer({ wilaya: "" }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    ).rejects.toMatchObject({ fields: { "customer.wilaya": "Choose your wilaya." } })
  })
})

describe("Wilaya and commune follow the official map", () => {
  const line = async () => (await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 3 }] })).variants[0].id

  it("stores the official names whatever the spelling or code", async () => {
    const variantId = await line()
    const order = await createOrder(testDb, {
      customer: customer({ wilaya: "31", city: "bir el djir" }),
      lines: [{ variantId, quantity: 1 }],
      idempotencyKey: key(),
    })
    expect(order).toMatchObject({ wilayaName: "Oran", city: "Bir El Djir" })
    const accents = await createOrder(testDb, { customer: customer({ wilaya: "BEJAIA", city: "Bejaia" }), lines: [{ variantId, quantity: 1 }], idempotencyKey: key() })
    expect(accents.wilayaName).toBe("Béjaïa")
  })

  it("knows the 69 wilayas, including the 2026 ones", async () => {
    const variantId = await line()
    const order = await createOrder(testDb, { customer: customer({ wilaya: "Barika", city: "Bitam" }), lines: [{ variantId, quantity: 1 }], idempotencyKey: key() })
    expect(order.wilayaName).toBe("Barika")
    await expect(
      createOrder(testDb, { customer: customer({ wilaya: "Atlantis", city: "Bitam" }), lines: [{ variantId, quantity: 1 }], idempotencyKey: key() })
    ).rejects.toMatchObject({ fields: { "customer.wilaya": "Choose your wilaya from the list." } })
  })

  it("refuses a commune from another wilaya", async () => {
    const variantId = await line()
    await expect(
      createOrder(testDb, { customer: customer({ wilaya: "Alger", city: "Bir El Djir" }), lines: [{ variantId, quantity: 1 }], idempotencyKey: key() })
    ).rejects.toMatchObject({ fields: { "customer.city": "Choose your commune in Alger." } })
  })
})

describe("Delete order", () => {
  it("releases reserved stock of an open order and removes its items", async () => {
    const p = await seedProduct({ slug: "hoodie", price: 4500, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const order = await orderOf(p.variants[0].id, 2)
    expect(await stockOf(p.variants[0].id)).toEqual({ physical: 5, reserved: 2, available: 3 })

    await deleteOrder(testDb, { orderId: order.id, actor })
    expect(await stockOf(p.variants[0].id)).toEqual({ physical: 5, reserved: 0, available: 5 })
    expect(await testDb.select().from(orders)).toHaveLength(0)
    expect(await testDb.select().from(orderItems)).toHaveLength(0)
    const [log] = await testDb.select().from(auditLogs).where(eq(auditLogs.action, "order.delete"))
    expect(log.data).toMatchObject({ number: order.number })
  })

  it("does not touch physical stock of a delivered order", async () => {
    const p = await seedProduct({ slug: "hoodie", price: 4500, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const order = await orderOf(p.variants[0].id, 1)
    await changeOrderStatus(testDb, { orderId: order.id, to: "delivered", actor })
    await deleteOrder(testDb, { orderId: order.id, actor })
    expect(await stockOf(p.variants[0].id)).toEqual({ physical: 4, reserved: 0, available: 4 })
  })
})

describe("Delete product / variant", () => {
  it("is blocked while units are reserved, then allowed; past orders keep their snapshot", async () => {
    const p = await seedProduct({ slug: "hoodie", price: 4500, variants: [{ size: "M", color: "Black", physical: 5 }, { size: "L", color: "Black", physical: 5 }] })
    const order = await orderOf(p.variants[0].id, 1)
    await expect(deleteProduct(testDb, p.product.id, actor)).rejects.toThrow(/reserved for open orders/)

    // Unreserved variant can go right away.
    await deleteVariant(testDb, p.variants[1].id, actor)

    await changeOrderStatus(testDb, { orderId: order.id, to: "delivered", actor })
    await deleteProduct(testDb, p.product.id, actor)
    expect(await testDb.select().from(products)).toHaveLength(0)
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    expect(item).toMatchObject({ productId: null, variantId: null, productName: "Product hoodie", size: "M", color: "Black" })
  })
})

describe("Delete customer", () => {
  it("is blocked by open orders; afterwards the orders stay but are unlinked", async () => {
    const p = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const order = await orderOf(p.variants[0].id)
    await expect(deleteCustomer(testDb, order.customerId!, actor)).rejects.toThrow(/open order/)

    await changeOrderStatus(testDb, { orderId: order.id, to: "cancelled", actor })
    await deleteCustomer(testDb, order.customerId!, actor)
    expect(await testDb.select().from(customers)).toHaveLength(0)
    const [kept] = await testDb.select().from(orders)
    expect(kept).toMatchObject({ id: order.id, customerId: null, customerName: "Test Customer" })
  })
})

describe("Delete return request", () => {
  it("releases the replacement held for an approved exchange", async () => {
    const p = await seedProduct({ slug: "hoodie", price: 4500, variants: [{ size: "M", color: "Black", physical: 5 }, { size: "L", color: "Black", physical: 5 }] })
    const order = await orderOf(p.variants[0].id)
    await changeOrderStatus(testDb, { orderId: order.id, to: "delivered", actor })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    const request = await createReturnRequest(testDb, {
      orderNumber: order.number,
      phone: order.customerPhone,
      orderItemId: item.id,
      type: "exchange",
      reason: "Wrong size",
      quantity: 1,
      replacementVariantId: p.variants[1].id,
    })
    await approveReturn(testDb, { id: request.id, actor })
    expect((await stockOf(p.variants[1].id)).reserved).toBe(1)

    await deleteReturn(testDb, { id: request.id, actor })
    expect(await stockOf(p.variants[1].id)).toEqual({ physical: 5, reserved: 0, available: 5 })
  })
})

describe("Delete abandoned bag", () => {
  it("removes the bag and its items", async () => {
    const p = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const [cart] = await testDb.insert(carts).values({}).returning()
    await testDb.insert(cartItems).values({ cartId: cart.id, variantId: p.variants[0].id, quantity: 1 })
    expect(await deleteCart(testDb, cart.id)).toEqual({ id: cart.id })
    expect(await testDb.select().from(cartItems)).toHaveLength(0)
    expect(await deleteCart(testDb, cart.id)).toBeNull()
  })
})

describe("Shops", () => {
  const shop = { name: "Test Shop A", wilaya: "Test Wilaya", city: "Test City", address: "1 Test Street", latitude: "36.7", longitude: "3.05" }

  it("saves, lists active shops in order, and deletes", async () => {
    const a = await saveStore(testDb, null, { ...shop, sortOrder: 2 }, actor)
    const b = await saveStore(testDb, null, { ...shop, name: "Test Shop B", latitude: "", longitude: "", sortOrder: 1 }, actor)
    await saveStore(testDb, null, { ...shop, name: "Hidden", active: false }, actor)
    expect(a).toMatchObject({ latitude: 36.7, longitude: 3.05 })
    expect(b).toMatchObject({ latitude: null, longitude: null })
    expect((await listStores(testDb, { activeOnly: true })).map((s) => s.name)).toEqual(["Test Shop B", "Test Shop A"])

    await deleteStore(testDb, a.id, actor)
    expect(await testDb.select().from(stores)).toHaveLength(2)
    await expect(deleteStore(testDb, a.id, actor)).rejects.toThrow()
  })

  it("rejects half coordinates and non-https map links", async () => {
    await expect(saveStore(testDb, null, { ...shop, longitude: "" }, actor)).rejects.toThrow(/both latitude and longitude/)
    await expect(saveStore(testDb, null, { ...shop, mapUrl: "javascript:alert(1)" }, actor)).rejects.toThrow(/https/)
    await expect(saveStore(testDb, null, { ...shop, latitude: "123" }, actor)).rejects.toThrow(/out of range/)
  })
})
