import { beforeEach, describe, expect, it } from "vitest"

import { createOrder } from "@/server/orders/create"
import { changeOrderStatus, setOrderStatusManually } from "@/server/orders/manage"
import { recordReturn } from "@/server/returns"
import { customer, deliver, key, resetDb, seedDelivery, seedProduct, stockOf, testDb } from "./support/db"

const admin = { userId: null, label: "Admin" }

beforeEach(async () => {
  await resetDb()
})

describe("Status by hand", () => {
  it("moves backwards and forwards with stock always right", async () => {
    const { wilaya } = await seedDelivery()
    const tee = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const v = tee.variants[0].id
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: v, quantity: 2 }], idempotencyKey: key() })
    expect(await stockOf(v)).toMatchObject({ physical: 5, reserved: 2 })

    await deliver(order.id, admin)
    expect(await stockOf(v)).toMatchObject({ physical: 3, reserved: 0 })

    // Delivered by mistake → back to Confirmed: units on the shelf and reserved again.
    let r = await setOrderStatusManually(testDb, { orderId: order.id, to: "confirmed", actor: admin })
    expect(r.order).toMatchObject({ status: "confirmed", paymentStatus: "due", deliveredAt: null })
    expect(await stockOf(v)).toMatchObject({ physical: 5, reserved: 2 })

    // Cancelled → units free; reopened as Pending → reserved again.
    await setOrderStatusManually(testDb, { orderId: order.id, to: "cancelled", actor: admin })
    expect(await stockOf(v)).toMatchObject({ physical: 5, reserved: 0 })
    r = await setOrderStatusManually(testDb, { orderId: order.id, to: "pending", actor: admin })
    expect(r.order.status).toBe("pending")
    expect(await stockOf(v)).toMatchObject({ physical: 5, reserved: 2 })

    // Straight to Delivered by hand.
    await setOrderStatusManually(testDb, { orderId: order.id, to: "delivered", actor: admin })
    expect(await stockOf(v)).toMatchObject({ physical: 3, reserved: 0 })
  })

  it("keeps Delivered once a return is recorded; a full return reads as refused", async () => {
    const { wilaya } = await seedDelivery()
    const tee = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: tee.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    await changeOrderStatus(testDb, { orderId: order.id, to: "confirmed", actor: admin })
    await deliver(order.id, admin)
    const { orderItems } = await import("@/server/db/schema")
    const { eq } = await import("drizzle-orm")
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    const ret = await recordReturn(testDb, { orderId: order.id, returned: [{ orderItemId: item.id, quantity: 1 }] }, admin)
    expect(ret.full).toBe(true)
    await expect(setOrderStatusManually(testDb, { orderId: order.id, to: "confirmed", actor: admin })).rejects.toThrow(/returns or exchanges/)
  })
})
