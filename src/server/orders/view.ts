import { timingSafeEqual } from "node:crypto"

import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm"

import type { Db, DbOrTx } from "../db/client"
import { orderItems, orderStatusHistory, orders, productVariants, products, returnRequests } from "../db/schema"
import { availableOf } from "../inventory"
import { CUSTOMER_ACTOR } from "../audit"
import { AppError, NotFoundError } from "../errors"
import { changeOrderStatus, type OrderStatus } from "./manage"

/** Customer-facing steps (admin statuses are more detailed). */
export const CUSTOMER_STEPS = [
  { key: "placed", label: "Order placed", statuses: ["pending"] },
  { key: "confirmed", label: "Confirmed", statuses: ["contacting", "confirmed"] },
  { key: "preparing", label: "Preparing", statuses: ["preparing"] },
  { key: "shipping", label: "On its way", statuses: ["ready_for_delivery"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
] as const

/** Statuses a customer may cancel from; once preparation starts they call the shop. */
export const CUSTOMER_CANCELLABLE = ["pending", "contacting", "confirmed"] as const

async function buildView(db: DbOrTx, order: typeof orders.$inferSelect) {
  const [items, history, returns] = await Promise.all([
    db.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), isNull(orderItems.removedAt))),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select().from(returnRequests).where(and(eq(returnRequests.orderId, order.id), ne(returnRequests.status, "rejected"))),
  ])

  // Exchange options: other sizes/colours of the same product with stock.
  const productIds = [...new Set(items.flatMap((i) => (i.productId ? [i.productId] : [])))]
  const options = productIds.length
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          size: productVariants.size,
          color: productVariants.color,
          physical: productVariants.physical,
          reserved: productVariants.reserved,
          active: productVariants.active,
          status: products.status,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.productId, productIds))
    : []

  const [shipsWith] = order.shipsWithOrderId
    ? await db.select({ number: orders.number }).from(orders).where(eq(orders.id, order.shipsWithOrderId))
    : []
  const reached = (statuses: readonly string[]) => history.find((h) => statuses.includes(h.toStatus))?.createdAt ?? null
  const timeline = CUSTOMER_STEPS.map((step) => ({ key: step.key, label: step.label, at: reached(step.statuses) }))
  const cancelledAt = order.status === "cancelled" ? order.cancelledAt : null

  return {
    number: order.number,
    status: order.status as OrderStatus,
    createdAt: order.createdAt,
    customerName: order.customerName,
    delivery: {
      wilaya: order.wilayaName,
      city: order.city,
      address: order.address,
      estimatedDays: order.estimatedDays,
    },
    money: {
      subtotal: order.subtotal,
      discount: order.discountAmount,
      deliveryFee: order.deliveryFee,
      freeDelivery: order.freeDelivery,
      /** Earlier order this one is delivered with (its delivery is already paid there). */
      shipsWith: shipsWith?.number ?? null,
      total: order.total,
    },
    items: items.map((i) => {
      const requested = returns.filter((r) => r.orderItemId === i.id).reduce((s, r) => s + r.quantity, 0)
      return {
        id: i.id,
        name: i.productName,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        imageUrl: i.imageUrl,
        returnable: order.status === "delivered" ? i.quantity - requested : 0,
        exchangeOptions: options
          .filter((o) => o.productId === i.productId && o.id !== i.variantId && o.active && o.status === "published" && availableOf(o) > 0)
          .map((o) => ({ id: o.id, label: `${o.color} / ${o.size}` })),
      }
    }),
    returns: returns.map((r) => ({ id: r.id, type: r.type, status: r.status, quantity: r.quantity, itemId: r.orderItemId })),
    /** Every piece came back (return approved or later) — same rule as the account list. */
    returned:
      order.status === "delivered" &&
      items.length > 0 &&
      items.every(
        (i) =>
          i.quantity <=
          returns.filter((r) => r.orderItemId === i.id && r.type === "return" && r.status !== "requested").reduce((s, r) => s + r.quantity, 0)
      ),
    timeline,
    cancelledAt,
    /** The customer can still cancel online (before preparation starts). */
    cancellable: (CUSTOMER_CANCELLABLE as readonly string[]).includes(order.status),
  }
}
export type CustomerOrderView = Awaited<ReturnType<typeof buildView>>

/** Order number + phone (both must match). Returns null rather than revealing which part was wrong. */
export async function findOrderForCustomer(db: DbOrTx, number: string, phone: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.customerPhone, phone)))
  return order ? buildView(db, order) : null
}

/** Confirmation page link (order number + secret token). */
export async function findOrderByToken(db: DbOrTx, number: string, token: string) {
  const [order] = await db.select().from(orders).where(eq(orders.number, number))
  if (!order) return null
  const a = Buffer.from(order.accessToken)
  const b = Buffer.from(token)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return buildView(db, order)
}

/**
 * Customer cancels their own order. Proof of ownership: the order's secret
 * link token (confirmation page / account) or the phone used to order.
 * Reserved stock is released by changeOrderStatus.
 */
export async function cancelOrderByCustomer(
  db: Db,
  input: { number: string; token?: string | null; phone?: string | null; reason?: string | null }
) {
  const [order] = await db.select().from(orders).where(eq(orders.number, input.number))
  const tokenOk = (() => {
    if (!order || !input.token) return false
    const a = Buffer.from(order.accessToken)
    const b = Buffer.from(input.token)
    return a.length === b.length && timingSafeEqual(a, b)
  })()
  const phoneOk = !!order && !!input.phone && order.customerPhone === input.phone
  if (!order || (!tokenOk && !phoneOk)) throw new NotFoundError("This order")
  if (order.status === "cancelled") return order
  if (!(CUSTOMER_CANCELLABLE as readonly string[]).includes(order.status)) {
    throw new AppError("TOO_LATE", "Your order is already being prepared or on its way — call us to cancel it.")
  }
  const reason = input.reason?.trim().slice(0, 300)
  const { order: updated } = await changeOrderStatus(db, {
    orderId: order.id,
    to: "cancelled",
    actor: CUSTOMER_ACTOR,
    note: reason ? `Cancelled by the customer — ${reason}` : "Cancelled by the customer",
  })
  return updated
}
