import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { orderItems, orderStatusHistory, orders, stockMovements } from "@/server/db/schema"
import { AppError, OutOfStockError } from "@/server/errors"
import { adjustPhysicalStock, receiveStock } from "@/server/inventory"
import { createOrder, ValidationError } from "@/server/orders/create"
import { applyOrderDiscount, changeOrderStatus, removeOrderItem, updateOrderItem } from "@/server/orders/manage"
import { approveReturn, completeReturn, createReturnByAdmin, createReturnRequest, markReturnReceived, rejectReturn } from "@/server/returns"

import { customer, key, resetDb, seedDelivery, seedProduct, stockOf, testDb } from "./support/db"

const admin = { userId: null, label: "Test admin" }

beforeEach(async () => {
  await resetDb()
})

async function setup(physical = 10) {
  const { wilaya } = await seedDelivery()
  const hoodie = await seedProduct({
    slug: "hoodie",
    price: 4500,
    variants: [
      { size: "M", color: "Black", physical },
      { size: "L", color: "Black", physical },
    ],
  })
  return { wilaya, hoodie, blackM: hoodie.variants[0], blackL: hoodie.variants[1] }
}

describe("TEST 1 — Buy Now creates an order and reserves stock", () => {
  it("reserves exactly the ordered quantity and uses server prices", async () => {
    const { wilaya, blackM } = await setup()
    const order = await createOrder(testDb, {
      customer: customer({ wilaya }),
      lines: [{ variantId: blackM.id, quantity: 3 }],
      idempotencyKey: key(),
    })

    expect(order.created).toBe(true)
    expect(order.number).toMatch(/^KING253-\d{8}-001$/)
    expect(order.subtotal).toBe(3 * 4500)
    expect(order.deliveryFee).toBe(500)
    expect(order.total).toBe(3 * 4500 + 500)
    expect(order.customerPhone).toBe("+213550000001")
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 3, available: 7 })
  })

  it("rejects invalid customer details server-side", async () => {
    const { wilaya, blackM } = await setup()
    await expect(
      createOrder(testDb, {
        customer: customer({ wilaya, phone: "12345", age: 5 }),
        lines: [{ variantId: blackM.id, quantity: 1 }],
        idempotencyKey: key(),
      })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 0, available: 10 })
  })
})

describe("TEST 3 — Buy All creates ONE order with several items", () => {
  it("one order, three order items, one customer", async () => {
    const { wilaya } = await setup()
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "L", color: "White", physical: 5 }] })
    const pants = await seedProduct({ slug: "pants", price: 3500, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const hoodie = (await testDb.query.productVariants.findMany())[0]

    const order = await createOrder(testDb, {
      customer: customer({ wilaya }),
      lines: [
        { variantId: hoodie.id, quantity: 1 },
        { variantId: tee.variants[0].id, quantity: 1 },
        { variantId: pants.variants[0].id, quantity: 1 },
      ],
      idempotencyKey: key(),
    })

    const allOrders = await testDb.select().from(orders)
    const items = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    expect(allOrders).toHaveLength(1)
    expect(items).toHaveLength(3)
    expect(order.subtotal).toBe(4500 + 2000 + 3500)
  })
})

describe("TEST 4 — Cancellation releases the reservation only", () => {
  it("physical stays, reserved returns to 0", async () => {
    const { wilaya, blackM } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 3 }], idempotencyKey: key() })
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 3, available: 7 })

    await changeOrderStatus(testDb, { orderId: order.id, to: "cancelled", actor: admin })
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 0, available: 10 })

    // Physical stock was never decreased, so nothing was "returned" to it.
    const physicalMoves = (await testDb.select().from(stockMovements)).filter((m) => m.physicalBefore !== m.physicalAfter)
    expect(physicalMoves).toHaveLength(0)
  })

  it("a closed order cannot be re-opened or cancelled twice", async () => {
    const { wilaya, blackM } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 1 }], idempotencyKey: key() })
    await changeOrderStatus(testDb, { orderId: order.id, to: "cancelled", actor: admin })
    await expect(changeOrderStatus(testDb, { orderId: order.id, to: "confirmed", actor: admin })).rejects.toBeInstanceOf(AppError)
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 0, available: 10 })
  })
})

describe("TEST 5 — Delivery consumes physical and reserved stock", () => {
  it("physical 10 → 7, reserved 3 → 0, with a full status timeline", async () => {
    const { wilaya, blackM } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 3 }], idempotencyKey: key() })
    for (const to of ["contacting", "confirmed", "preparing", "ready_for_delivery"] as const) {
      await changeOrderStatus(testDb, { orderId: order.id, to, actor: admin })
      expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 3, available: 7 })
    }
    await changeOrderStatus(testDb, { orderId: order.id, to: "delivered", actor: admin, note: "Handed to customer" })
    expect(await stockOf(blackM.id)).toEqual({ physical: 7, reserved: 0, available: 7 })

    const history = await testDb.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id))
    expect(history.map((h) => h.toStatus)).toEqual(["pending", "contacting", "confirmed", "preparing", "ready_for_delivery", "delivered"])
  })
})

describe("TEST 6 — Out of stock", () => {
  it("available 0 refuses the order and creates nothing", async () => {
    const { wilaya } = await setup()
    const scarce = await seedProduct({ slug: "scarce", price: 1000, variants: [{ size: "S", color: "Red", physical: 5, reserved: 5 }] })
    await expect(
      createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: scarce.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    ).rejects.toBeInstanceOf(OutOfStockError)
    expect(await testDb.select().from(orders)).toHaveLength(0)
    expect(await stockOf(scarce.variants[0].id)).toEqual({ physical: 5, reserved: 5, available: 0 })
  })

  it("a multi-item order rolls back entirely if one line is short", async () => {
    const { wilaya, blackM, blackL } = await setup(2)
    await expect(
      createOrder(testDb, {
        customer: customer({ wilaya }),
        lines: [
          { variantId: blackM.id, quantity: 1 },
          { variantId: blackL.id, quantity: 3 },
        ],
        idempotencyKey: key(),
      })
    ).rejects.toBeInstanceOf(OutOfStockError)
    expect(await stockOf(blackM.id)).toEqual({ physical: 2, reserved: 0, available: 2 })
    expect(await testDb.select().from(orders)).toHaveLength(0)
  })

  it("draft products cannot be bought even with stock", async () => {
    const { wilaya } = await setup()
    const draft = await seedProduct({ slug: "draft", price: 1000, status: "draft", variants: [{ size: "M", color: "Black", physical: 5 }] })
    await expect(
      createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: draft.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    ).rejects.toThrow(/no longer available/)
  })
})

describe("TEST 7 — Concurrent purchase of the last unit", () => {
  it("only one of many simultaneous buyers succeeds; stock never goes negative", async () => {
    const { wilaya } = await setup()
    const last = await seedProduct({ slug: "last", price: 9000, variants: [{ size: "M", color: "Black", physical: 1 }] })
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        createOrder(testDb, {
          customer: customer({ wilaya, phone: `055000010${i}` }),
          lines: [{ variantId: last.variants[0].id, quantity: 1 }],
          idempotencyKey: key(),
        })
      )
    )
    const ok = attempts.filter((a) => a.status === "fulfilled")
    const failed = attempts.filter((a) => a.status === "rejected")
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(5)
    for (const f of failed) expect((f as PromiseRejectedResult).reason).toBeInstanceOf(OutOfStockError)
    expect(await stockOf(last.variants[0].id)).toEqual({ physical: 1, reserved: 1, available: 0 })
  })
})

describe("Duplicate submission protection", () => {
  it("the same idempotency key returns the same order, even when racing", async () => {
    const { wilaya, blackM } = await setup()
    const input = { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 2 }], idempotencyKey: key() }
    const results = await Promise.all([createOrder(testDb, input), createOrder(testDb, input), createOrder(testDb, input)])
    expect(new Set(results.map((r) => r.id)).size).toBe(1)
    expect(await testDb.select().from(orders)).toHaveLength(1)
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 2, available: 8 })
  })
})

describe("TEST 8 — Order edit moves the reservation", () => {
  it("Black/M × 2 → Black/L × 2 releases M and reserves L", async () => {
    const { wilaya, blackM, blackL } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 2 }], idempotencyKey: key() })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))

    await updateOrderItem(testDb, { orderId: order.id, itemId: item.id, variantId: blackL.id, quantity: 2, actor: admin })
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 0, available: 10 })
    expect(await stockOf(blackL.id)).toEqual({ physical: 10, reserved: 2, available: 8 })

    const [edited] = await testDb.select().from(orderItems).where(eq(orderItems.id, item.id))
    expect(edited.size).toBe("L")
  })

  it("a failed edit (not enough stock) changes nothing", async () => {
    const { wilaya, blackM } = await setup(3)
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 2 }], idempotencyKey: key() })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    await expect(updateOrderItem(testDb, { orderId: order.id, itemId: item.id, variantId: blackM.id, quantity: 4, actor: admin })).rejects.toBeInstanceOf(OutOfStockError)
    expect(await stockOf(blackM.id)).toEqual({ physical: 3, reserved: 2, available: 1 })
  })

  it("removing an item releases it and recalculates totals", async () => {
    const { wilaya, blackM, blackL } = await setup()
    const order = await createOrder(testDb, {
      customer: customer({ wilaya }),
      lines: [
        { variantId: blackM.id, quantity: 1 },
        { variantId: blackL.id, quantity: 1 },
      ],
      idempotencyKey: key(),
    })
    const items = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    const updated = await removeOrderItem(testDb, { orderId: order.id, itemId: items[0].id, actor: admin })
    expect(updated.subtotal).toBe(4500)
    expect(updated.total).toBe(5000)
  })
})

describe("Discounts are validated server-side", () => {
  it("8500 subtotal − 500 discount + 500 delivery = 8500", async () => {
    const { wilaya } = await setup()
    const p = await seedProduct({ slug: "p8500", price: 8500, variants: [{ size: "M", color: "Black", physical: 2 }] })
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    const updated = await applyOrderDiscount(testDb, { orderId: order.id, discount: { type: "fixed", value: 500 }, actor: admin })
    expect(updated.total).toBe(8500)
  })

  it("rejects discounts above the subtotal and percentages above 100", async () => {
    const { wilaya, blackM } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 1 }], idempotencyKey: key() })
    await expect(applyOrderDiscount(testDb, { orderId: order.id, discount: { type: "fixed", value: 99999 }, actor: admin })).rejects.toBeInstanceOf(AppError)
    await expect(applyOrderDiscount(testDb, { orderId: order.id, discount: { type: "percent", value: 120 }, actor: admin })).rejects.toBeInstanceOf(AppError)
    const percent = await applyOrderDiscount(testDb, { orderId: order.id, discount: { type: "percent", value: 10 }, actor: admin })
    expect(percent.discountAmount).toBe(450)
  })
})

describe("Manual stock adjustments", () => {
  it("are recorded with a reason and cannot go below reserved stock", async () => {
    const { wilaya, blackM } = await setup()
    await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 4 }], idempotencyKey: key() })
    const actorUserId = null as unknown as string
    await expect(testDb.transaction((tx) => adjustPhysicalStock(tx, { variantId: blackM.id, newPhysical: 3, reason: "Recount", actorUserId }))).rejects.toThrow(/reserved/)
    await testDb.transaction((tx) => adjustPhysicalStock(tx, { variantId: blackM.id, newPhysical: 12, reason: "New delivery from workshop", actorUserId }))
    expect(await stockOf(blackM.id)).toEqual({ physical: 12, reserved: 4, available: 8 })
    const [adjustment] = (await testDb.select().from(stockMovements)).filter((m) => m.type === "adjustment")
    expect(adjustment).toMatchObject({ physicalBefore: 10, physicalAfter: 12, reason: "New delivery from workshop" })
  })
})

describe("TEST 9 — Size exchange after delivery", () => {
  it("M returned resellable goes back on the shelf; L is reserved then shipped", async () => {
    const { wilaya, blackM, blackL } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 1 }], idempotencyKey: key() })
    await changeOrderStatus(testDb, { orderId: order.id, to: "delivered", actor: admin })
    expect(await stockOf(blackM.id)).toEqual({ physical: 9, reserved: 0, available: 9 })

    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    const request = await createReturnRequest(testDb, {
      orderNumber: order.number,
      phone: order.customerPhone,
      orderItemId: item.id,
      type: "exchange",
      reason: "Wrong size",
      quantity: 1,
      replacementVariantId: blackL.id,
    })
    // Nothing moves until an admin approves.
    expect(await stockOf(blackL.id)).toEqual({ physical: 10, reserved: 0, available: 10 })

    await approveReturn(testDb, { id: request.id, actor: admin })
    expect(await stockOf(blackL.id)).toEqual({ physical: 10, reserved: 1, available: 9 })

    await markReturnReceived(testDb, { id: request.id, condition: "resellable", actor: admin })
    expect(await stockOf(blackM.id)).toEqual({ physical: 10, reserved: 0, available: 10 })

    await completeReturn(testDb, { id: request.id, actor: admin })
    expect(await stockOf(blackL.id)).toEqual({ physical: 9, reserved: 0, available: 9 })
  })

  it("rejecting an approved exchange releases the replacement; damaged returns are not restocked", async () => {
    const { wilaya, blackM, blackL } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 2 }], idempotencyKey: key() })
    await changeOrderStatus(testDb, { orderId: order.id, to: "delivered", actor: admin })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))

    const exchange = await createReturnRequest(testDb, { orderNumber: order.number, phone: order.customerPhone, orderItemId: item.id, type: "exchange", reason: "Wrong size", quantity: 1, replacementVariantId: blackL.id })
    await approveReturn(testDb, { id: exchange.id, actor: admin })
    await rejectReturn(testDb, { id: exchange.id, actor: admin })
    expect(await stockOf(blackL.id)).toEqual({ physical: 10, reserved: 0, available: 10 })

    const refund = await createReturnRequest(testDb, { orderNumber: order.number, phone: order.customerPhone, orderItemId: item.id, type: "return", reason: "Product issue", quantity: 1 })
    await approveReturn(testDb, { id: refund.id, actor: admin })
    await markReturnReceived(testDb, { id: refund.id, condition: "damaged", actor: admin })
    expect(await stockOf(blackM.id)).toEqual({ physical: 8, reserved: 0, available: 8 })
  })

  it("requires the right phone and a delivered order", async () => {
    const { wilaya, blackM } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 1 }], idempotencyKey: key() })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    const base = { orderNumber: order.number, orderItemId: item.id, type: "return" as const, reason: "Other", quantity: 1 }
    await expect(createReturnRequest(testDb, { ...base, phone: "+213550999999" })).rejects.toThrow(/could not be found/)
    await expect(createReturnRequest(testDb, { ...base, phone: order.customerPhone })).rejects.toThrow(/delivered/)
  })
})

describe("Restock any time", () => {
  it("adds received units on top of current stock, keeps reservations, and logs it", async () => {
    const { wilaya, blackM } = await setup(2)
    await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 2 }], idempotencyKey: key() })
    expect(await stockOf(blackM.id)).toEqual({ physical: 2, reserved: 2, available: 0 })

    const [u] = await testDb.execute<{ id: string }>(sql`insert into users (email, name, password_hash, role) values ('a@test.local', 'A', 'x', 'admin') returning id`)
    await testDb.transaction((tx) => receiveStock(tx, { variantId: blackM.id, quantity: 20, note: "Workshop batch", actorUserId: u.id }))
    expect(await stockOf(blackM.id)).toEqual({ physical: 22, reserved: 2, available: 20 })

    const moves = await testDb.select().from(stockMovements).where(eq(stockMovements.variantId, blackM.id))
    expect(moves.at(-1)).toMatchObject({ type: "adjustment", physicalBefore: 2, physicalAfter: 22, reason: "New stock received: +20 — Workshop batch" })
    await expect(testDb.transaction((tx) => receiveStock(tx, { variantId: blackM.id, quantity: 0, actorUserId: u.id }))).rejects.toThrow(/how many units/)
  })
})

describe("Shop records a return / exchange", () => {
  it("approved straight away: replacement reserved, returned item restocked, replacement shipped", async () => {
    const { wilaya, blackM, blackL } = await setup()
    const order = await createOrder(testDb, { customer: customer({ wilaya }), lines: [{ variantId: blackM.id, quantity: 2 }], idempotencyKey: key() })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    await expect(
      createReturnByAdmin(testDb, { orderId: order.id, orderItemId: item.id, type: "return", reason: "Wrong size", quantity: 1, actor: admin })
    ).rejects.toThrow(/delivered/)

    await changeOrderStatus(testDb, { orderId: order.id, to: "delivered", actor: admin })
    const r = await createReturnByAdmin(testDb, {
      orderId: order.id,
      orderItemId: item.id,
      type: "exchange",
      reason: "Wrong size",
      quantity: 1,
      replacementVariantId: blackL.id,
      approve: true,
      actor: admin,
    })
    expect(r.status).toBe("approved")
    expect(await stockOf(blackL.id)).toEqual({ physical: 10, reserved: 1, available: 9 })

    await markReturnReceived(testDb, { id: r.id, condition: "resellable", actor: admin })
    await completeReturn(testDb, { id: r.id, actor: admin })
    expect(await stockOf(blackM.id)).toEqual({ physical: 9, reserved: 0, available: 9 })
    expect(await stockOf(blackL.id)).toEqual({ physical: 9, reserved: 0, available: 9 })

    await expect(
      createReturnByAdmin(testDb, { orderId: order.id, orderItemId: item.id, type: "return", reason: "Other", quantity: 2, actor: admin })
    ).rejects.toThrow(/up to 1/)
  })
})
