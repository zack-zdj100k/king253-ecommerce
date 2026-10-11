import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { orders } from "@/server/db/schema"
import { getAnalytics } from "@/server/analytics"
import { createOrder } from "@/server/orders/create"
import { changeOrderStatus, deleteOrder, updateOrderDelivery } from "@/server/orders/manage"
import { orderMoney } from "@/server/pricing"
import { saveSettings } from "@/server/settings"

import { customer, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

const admin = { userId: null, label: "Test admin" }

beforeEach(async () => {
  await resetDb()
})

async function setup() {
  await seedDelivery(800)
  const tee = await seedProduct({ slug: "tee", price: 4500, variants: [{ size: "M", color: "Black", physical: 20 }] })
  const jeans = await seedProduct({ slug: "jeans", price: 6000, variants: [{ size: "32", color: "Blue", physical: 20 }] })
  const buy = (variantId: string, who: Partial<{ phone: string; wilaya: string; city: string }> = {}) =>
    createOrder(testDb, { customer: customer({ wilaya: "Alger", ...who }), lines: [{ variantId, quantity: 1 }], idempotencyKey: key() })
  return { tee: tee.variants[0].id, jeans: jeans.variants[0].id, buy }
}
const get = async (id: string) => (await testDb.select().from(orders).where(eq(orders.id, id)))[0]

describe("Delivery is not part of the clothes price", () => {
  it("customer pays clothes + delivery; the shop keeps the clothes", async () => {
    const { tee, buy } = await setup()
    const o = await buy(tee)
    expect(orderMoney(o)).toEqual({ clothes: 4500, deliveryFee: 800, customerDelivery: 800, toCollect: 5300, shopKeeps: 4500 })
    expect(o.total).toBe(5300)
  })

  it("free delivery: customer pays only the clothes, the shop keeps clothes − delivery", async () => {
    const { tee, buy } = await setup()
    const o = await buy(tee)
    const updated = await updateOrderDelivery(testDb, { orderId: o.id, wilaya: "Alger", city: "Bab Ezzouar", address: "1 Test Street", deliveryFee: 800, freeDelivery: true, actor: admin })
    expect(updated.total).toBe(4500)
    expect(orderMoney(updated).shopKeeps).toBe(3700)
  })

  it("revenue counts clothes only (minus delivery the shop pays)", async () => {
    const { tee, jeans, buy } = await setup()
    await buy(tee) // 4500 + 800 delivery
    const free = await buy(jeans, { phone: "0550000099" }) // another customer
    await updateOrderDelivery(testDb, { orderId: free.id, wilaya: "Alger", city: "Bab Ezzouar", address: "x street", deliveryFee: 800, freeDelivery: true, actor: admin })
    const day = 86_400_000
    const a = await getAnalytics(testDb, { from: new Date(Date.now() - day), to: new Date(Date.now() + day) })
    expect(a.bookedRevenue).toBe(4500 + (6000 - 800))
  })
})

describe("One delivery per customer until it is delivered", () => {
  it("ordering again before delivery shares the delivery: no second fee", async () => {
    const { tee, jeans, buy } = await setup()
    const first = await buy(tee)
    const second = await buy(jeans)
    expect(second).toMatchObject({ shipsWithOrderId: first.id, deliveryFee: 0, total: 6000 })
    expect((await get(first.id)).total).toBe(5300)
  })

  it("a different address or customer is a separate delivery", async () => {
    const { tee, jeans, buy } = await setup()
    await buy(tee)
    const elsewhere = await buy(jeans, { city: "Bir Mourad Rais" })
    expect(elsewhere).toMatchObject({ shipsWithOrderId: null, deliveryFee: 800 })
    const someoneElse = await buy(jeans, { phone: "0550000077" })
    expect(someoneElse.shipsWithOrderId).toBeNull()
  })

  it("after the first order is delivered, a new order pays delivery again", async () => {
    const { tee, jeans, buy } = await setup()
    const first = await buy(tee)
    await changeOrderStatus(testDb, { orderId: first.id, to: "delivered", actor: admin })
    const again = await buy(jeans)
    expect(again).toMatchObject({ shipsWithOrderId: null, deliveryFee: 800, total: 6800 })
  })

  it("if the first order is cancelled, the next one takes over the delivery fee", async () => {
    const { tee, jeans, buy } = await setup()
    const first = await buy(tee)
    const second = await buy(jeans)
    await changeOrderStatus(testDb, { orderId: first.id, to: "cancelled", actor: admin })
    expect(await get(second.id)).toMatchObject({ shipsWithOrderId: null, deliveryFee: 800, total: 6800 })
  })

  it("deleting the first order hands its delivery over too", async () => {
    const { tee, jeans, buy } = await setup()
    const first = await buy(tee)
    const second = await buy(jeans)
    const third = await buy(tee)
    await deleteOrder(testDb, { orderId: first.id, actor: admin })
    expect(await get(second.id)).toMatchObject({ shipsWithOrderId: null, deliveryFee: 800 })
    expect((await get(third.id)).shipsWithOrderId).toBe(second.id)
  })

  it("free-delivery promotion counts the orders of one delivery together", async () => {
    const { tee, jeans, buy } = await setup()
    await saveSettings(testDb, { freeDelivery: true, freeDeliveryMin: 10000 })
    const first = await buy(tee) // 4500 — below 10000, customer pays delivery
    expect(first).toMatchObject({ freeDelivery: false, total: 5300 })
    await buy(jeans) // + 6000 = 10500 → the shared delivery becomes free
    expect(await get(first.id)).toMatchObject({ freeDelivery: true, total: 4500 })
  })
})

describe("Completed returns are deducted from revenue", () => {
  it("refunds what the customer paid (after discount); exchanges change nothing", async () => {
    const { applyOrderDiscount } = await import("@/server/orders/manage")
    const { approveReturn, completeReturn, createReturnRequest, markReturnReceived } = await import("@/server/returns")
    const { orderItems } = await import("@/server/db/schema")
    await seedDelivery(800)
    const tee = await seedProduct({ slug: "tee", price: 6500, variants: [{ size: "S", color: "Blue", physical: 5 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: tee.variants[0].id, quantity: 2 }], idempotencyKey: key() })
    await applyOrderDiscount(testDb, { orderId: o.id, discount: { type: "percent", value: 10 }, actor: admin })
    await changeOrderStatus(testDb, { orderId: o.id, to: "delivered", actor: admin })
    const range = { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000) }
    expect((await getAnalytics(testDb, range)).deliveredRevenue).toBe(11700)

    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    const r = await createReturnRequest(testDb, { orderNumber: o.number, phone: o.customerPhone, orderItemId: item.id, type: "return", reason: "Changed my mind", quantity: 1 })
    await approveReturn(testDb, { id: r.id, actor: admin })
    await markReturnReceived(testDb, { id: r.id, condition: "resellable", actor: admin })
    expect((await getAnalytics(testDb, range)).deliveredRevenue).toBe(11700) // not refunded until completed
    const done = await completeReturn(testDb, { id: r.id, actor: admin })
    expect(done.refundAmount).toBe(5850) // 6500 − 10%

    const a = await getAnalytics(testDb, range)
    expect(a.deliveredRevenue).toBe(5850)
    expect(a.units).toBe(1)
  })
})
