import { beforeEach, describe, expect, it } from "vitest"

import { createOrder } from "@/server/orders/create"
import { changeOrderStatus } from "@/server/orders/manage"
import { cancelOrderByCustomer, findOrderByToken } from "@/server/orders/view"

import { customer, key, resetDb, seedDelivery, seedProduct, stockOf, testDb } from "./support/db"

const admin = { userId: null, label: "Test admin" }

beforeEach(async () => {
  await resetDb()
})

async function setup() {
  await seedDelivery()
  const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
  const order = await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: p.variants[0].id, quantity: 2 }], idempotencyKey: key() })
  return { order, variantId: p.variants[0].id }
}

describe("Customer cancels an order", () => {
  it("with the secret link: order cancelled and reserved stock released", async () => {
    const { order, variantId } = await setup()
    expect((await findOrderByToken(testDb, order.number, order.accessToken))?.cancellable).toBe(true)
    expect(await stockOf(variantId)).toMatchObject({ reserved: 2, available: 3 })
    const cancelled = await cancelOrderByCustomer(testDb, { number: order.number, token: order.accessToken, reason: "I changed my mind" })
    expect(cancelled.status).toBe("cancelled")
    expect(await stockOf(variantId)).toEqual({ physical: 5, reserved: 0, available: 5 })
  })

  it("with the order phone, but not with a wrong phone or token", async () => {
    const { order } = await setup()
    await expect(cancelOrderByCustomer(testDb, { number: order.number, phone: "+213550999999" })).rejects.toThrow(/could not be found|not found/i)
    await expect(cancelOrderByCustomer(testDb, { number: order.number, token: "x".repeat(order.accessToken.length) })).rejects.toThrow()
    expect((await cancelOrderByCustomer(testDb, { number: order.number, phone: order.customerPhone })).status).toBe("cancelled")
  })

  it("is refused once preparation started", async () => {
    const { order } = await setup()
    await changeOrderStatus(testDb, { orderId: order.id, to: "preparing", actor: admin })
    expect((await findOrderByToken(testDb, order.number, order.accessToken))?.cancellable).toBe(false)
    await expect(cancelOrderByCustomer(testDb, { number: order.number, token: order.accessToken })).rejects.toThrow(/call us/)
  })
})
