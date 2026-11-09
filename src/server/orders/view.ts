import { timingSafeEqual } from "node:crypto"

import { and, asc, eq, inArray, isNull } from "drizzle-orm"

import type { Db, DbOrTx } from "../db/client"
import { orderItems, orderStatusHistory, orders, returnJournal, returnJournalItems } from "../db/schema"
import { CUSTOMER_ACTOR } from "../audit"
import { AppError, NotFoundError } from "../errors"
import { changeOrderStatus, type OrderStatus } from "./manage"

/** Customer-facing steps (old in-between statuses count as the step they belong to). */
export const CUSTOMER_STEPS = [
  { key: "placed", label: "Order placed", statuses: ["pending", "contacting"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed", "preparing", "ready_for_delivery"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
] as const

/** Statuses a customer may cancel from online; after that they call the shop. */
export const CUSTOMER_CANCELLABLE = ["pending", "contacting", "confirmed"] as const

async function buildView(db: DbOrTx, order: typeof orders.$inferSelect) {
  const [items, history, journal] = await Promise.all([
    db.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), isNull(orderItems.removedAt))).orderBy(asc(orderItems.createdAt)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select().from(returnJournal).where(eq(returnJournal.orderId, order.id)).orderBy(asc(returnJournal.createdAt)),
  ])
  const journalItems = journal.length
    ? await db.select().from(returnJournalItems).where(inArray(returnJournalItems.journalId, journal.map((j) => j.id)))
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
      type: order.deliveryType,
      deskName: order.deskName,
      deskAddress: order.deskAddress,
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
    /** Original items (exchange items are listed under returns). */
    items: items
      .filter((i) => !i.exchangeJournalId)
      .map((i) => ({
        id: i.id,
        name: i.productName,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        returnedQuantity: i.returnedQuantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        imageUrl: i.imageUrl,
      })),
    /** Returns & exchanges done by the shop, with what came back and what was given. */
    returns: journal.map((j) => ({
      id: j.id,
      type: j.type,
      amount: j.amount,
      at: j.createdAt,
      items: journalItems
        .filter((i) => i.journalId === j.id)
        .map((i) => ({ direction: i.direction as "in" | "out", name: i.productName, size: i.size, color: i.color, quantity: i.quantity })),
    })),
    /** Every piece came back: the order brought no money. */
    returned: order.status === "delivered" && order.paymentStatus === "refused",
    timeline,
    cancelledAt,
    /** The customer can still cancel online. */
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
    throw new AppError("TOO_LATE", "Your order can no longer be cancelled online — call us.")
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
