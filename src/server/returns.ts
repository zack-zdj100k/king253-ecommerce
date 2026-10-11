import { and, eq, inArray, ne, sql } from "drizzle-orm"

import type { Db, Tx } from "./db/client"
import { orderItems, orders, productVariants, returnRequests, stockReservations } from "./db/schema"
import { audit, CUSTOMER_ACTOR, type Actor } from "./audit"
import { AppError, NotFoundError } from "./errors"
import { consumeReservation, releaseReservation, reserveStock, restockReturnedUnits } from "./inventory"
import { refundFor } from "./pricing"

export const RETURN_REASONS = ["Wrong size", "Wrong colour", "Product issue", "Changed my mind", "Other"] as const

/**
 * Customer asks to return/exchange part of a DELIVERED order. Identity is
 * proven with order number + phone. Nothing moves in stock until an admin acts.
 */
type ReturnInput = {
  orderItemId: string
  type: "return" | "exchange"
  reason: string
  details?: string | null
  quantity: number
  replacementVariantId?: string | null
}

/**
 * Customer asks to return/exchange part of a DELIVERED order. Identity is
 * proven with order number + phone. Nothing moves in stock until an admin acts.
 */
export async function createReturnRequest(db: Db, input: ReturnInput & { orderNumber: string; phone: string }) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.number, input.orderNumber), eq(orders.customerPhone, input.phone)))
      .for("update")
    if (!order) throw new NotFoundError("This order")
    return insertReturn(tx, order, input, CUSTOMER_ACTOR)
  })
}

/**
 * Admin records a return/exchange (customer came to the shop or called).
 * Same checks as the customer flow; `approve` skips the "requested" step and,
 * for an exchange, reserves the replacement straight away.
 */
export async function createReturnByAdmin(db: Db, input: ReturnInput & { orderId: string; actor: Actor; approve?: boolean }) {
  const created = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for("update")
    if (!order) throw new NotFoundError("This order")
    return insertReturn(tx, order, input, input.actor)
  })
  return input.approve ? approveReturn(db, { id: created.id, actor: input.actor, note: "Recorded and approved by the shop" }) : created
}

async function insertReturn(tx: Tx, order: typeof orders.$inferSelect, input: ReturnInput, actor: Actor) {
  const reason = input.reason.trim()
  if (!reason) throw new AppError("REASON_REQUIRED", "Tell us why you want to return this item.")
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new AppError("INVALID_QUANTITY", "Choose a quantity.")
  if (order.status !== "delivered") throw new AppError("NOT_DELIVERED", "Returns and exchanges open once the order is delivered.")

  const [item] = await tx
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, order.id)))
  if (!item || item.removedAt) throw new NotFoundError("This item")

  const [{ requested }] = await tx
    .select({ requested: sql<number>`coalesce(sum(${returnRequests.quantity}), 0)::int` })
    .from(returnRequests)
    .where(and(eq(returnRequests.orderItemId, item.id), ne(returnRequests.status, "rejected")))
  const remaining = item.quantity - requested
  if (input.quantity > remaining) {
    throw new AppError("TOO_MANY", remaining > 0 ? `You can return up to ${remaining} of this item.` : "A request already covers this item.")
  }

  let replacementVariantId: string | null = null
  if (input.type === "exchange") {
    if (!input.replacementVariantId) throw new AppError("REPLACEMENT_REQUIRED", "Choose the size or colour you want instead.")
    const [replacement] = await tx
      .select({ id: productVariants.id, productId: productVariants.productId, active: productVariants.active })
      .from(productVariants)
      .where(eq(productVariants.id, input.replacementVariantId))
    if (!replacement || !replacement.active || replacement.productId !== item.productId) {
      throw new AppError("INVALID_REPLACEMENT", "Choose another size or colour of the same product.")
    }
    if (replacement.id === item.variantId) throw new AppError("INVALID_REPLACEMENT", "Choose a different size or colour.")
    replacementVariantId = replacement.id
  }

  const [created] = await tx
    .insert(returnRequests)
    .values({
      orderId: order.id,
      orderItemId: item.id,
      type: input.type,
      reason,
      details: input.details?.trim() || null,
      quantity: input.quantity,
      replacementVariantId,
    })
    .returning()
  await audit(tx, actor, "return.request", "return", created.id, { order: order.number, type: input.type })
  return created
}

async function lockReturn(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], id: string) {
  const [request] = await tx.select().from(returnRequests).where(eq(returnRequests.id, id)).for("update")
  if (!request) throw new NotFoundError("This return request")
  return request
}

/** Approve. For an exchange the replacement unit is reserved now so it cannot be sold to someone else. */
export async function approveReturn(db: Db, input: { id: string; actor: Actor; note?: string | null }) {
  return db.transaction(async (tx) => {
    const request = await lockReturn(tx, input.id)
    if (request.status !== "requested") throw new AppError("INVALID_STATE", "Only new requests can be approved.")
    if (request.type === "exchange" && request.replacementVariantId) {
      await reserveStock(tx, {
        variantId: request.replacementVariantId,
        quantity: request.quantity,
        returnRequestId: request.id,
        label: "The replacement",
        refType: "return",
        refId: request.id,
        actorUserId: input.actor.userId,
        reason: "Exchange approved",
      })
    }
    const [updated] = await tx
      .update(returnRequests)
      .set({ status: "approved", adminNote: input.note?.trim() || request.adminNote })
      .where(eq(returnRequests.id, request.id))
      .returning()
    await audit(tx, input.actor, "return.approve", "return", request.id, {})
    return updated
  })
}

export async function rejectReturn(db: Db, input: { id: string; actor: Actor; note?: string | null }) {
  return db.transaction(async (tx) => {
    const request = await lockReturn(tx, input.id)
    if (!["requested", "approved"].includes(request.status)) throw new AppError("INVALID_STATE", "This request can no longer be rejected.")
    const reservations = await tx
      .select({ id: stockReservations.id })
      .from(stockReservations)
      .where(and(eq(stockReservations.returnRequestId, request.id), eq(stockReservations.status, "active")))
    for (const r of reservations) {
      await releaseReservation(tx, r.id, { refType: "return", refId: request.id, actorUserId: input.actor.userId, reason: "Exchange rejected" })
    }
    const [updated] = await tx
      .update(returnRequests)
      .set({ status: "rejected", adminNote: input.note?.trim() || request.adminNote })
      .where(eq(returnRequests.id, request.id))
      .returning()
    await audit(tx, input.actor, "return.reject", "return", request.id, {})
    return updated
  })
}

/** The original item is back. Resellable units return to physical stock; damaged ones do not. */
export async function markReturnReceived(db: Db, input: { id: string; condition: "resellable" | "damaged"; actor: Actor }) {
  return db.transaction(async (tx) => {
    const request = await lockReturn(tx, input.id)
    if (request.status !== "approved") throw new AppError("INVALID_STATE", "Approve the request before receiving the item.")
    const [item] = await tx.select().from(orderItems).where(eq(orderItems.id, request.orderItemId))
    if (input.condition === "resellable") {
      if (!item?.variantId) {
        throw new AppError("VARIANT_DELETED", "This product option was deleted, so the item cannot go back into stock. Mark it as damaged instead.")
      }
      await restockReturnedUnits(tx, {
        variantId: item.variantId,
        quantity: request.quantity,
        refType: "return",
        refId: request.id,
        actorUserId: input.actor.userId,
        reason: `Returned ${request.type === "exchange" ? "for exchange" : "item"} — resellable`,
      })
    }
    const [updated] = await tx
      .update(returnRequests)
      .set({ status: "received", condition: input.condition })
      .where(eq(returnRequests.id, request.id))
      .returning()
    await audit(tx, input.actor, "return.receive", "return", request.id, { condition: input.condition })
    return updated
  })
}

/** Done. For an exchange the replacement leaves the shop: its reservation is consumed. */
export async function completeReturn(db: Db, input: { id: string; actor: Actor }) {
  return db.transaction(async (tx) => {
    const request = await lockReturn(tx, input.id)
    if (request.status !== "received") throw new AppError("INVALID_STATE", "Receive the returned item first.")
    if (request.type === "exchange") {
      const reservations = await tx
        .select({ id: stockReservations.id })
        .from(stockReservations)
        .where(and(eq(stockReservations.returnRequestId, request.id), eq(stockReservations.status, "active")))
      for (const r of reservations) {
        await consumeReservation(tx, r.id, {
          type: "exchange_ship",
          refType: "return",
          refId: request.id,
          actorUserId: input.actor.userId,
          reason: "Exchange replacement handed over",
        })
      }
    }
    // A return (not an exchange) gives the money back: recorded so revenue drops by exactly that.
    let refundAmount: number | null = null
    if (request.type === "return") {
      const [line] = await tx
        .select({ unitPrice: orderItems.unitPrice, subtotal: orders.subtotal, discountAmount: orders.discountAmount })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(eq(orderItems.id, request.orderItemId))
      refundAmount = line ? refundFor(line, request.quantity, line) : 0
    }
    const [updated] = await tx.update(returnRequests).set({ status: "completed", refundAmount }).where(eq(returnRequests.id, request.id)).returning()
    await audit(tx, input.actor, "return.complete", "return", request.id, { refund: refundAmount })
    return updated
  })
}

export async function returnsForOrders(db: Db, orderIds: string[]) {
  if (!orderIds.length) return []
  return db.select().from(returnRequests).where(inArray(returnRequests.orderId, orderIds))
}

/** Permanently removes a request; a replacement still on hold goes back to "available". */
export async function deleteReturn(db: Db, input: { id: string; actor: Actor }) {
  return db.transaction(async (tx) => {
    const request = await lockReturn(tx, input.id)
    const holds = await tx
      .select({ id: stockReservations.id })
      .from(stockReservations)
      .where(and(eq(stockReservations.returnRequestId, request.id), eq(stockReservations.status, "active")))
    for (const r of holds) {
      await releaseReservation(tx, r.id, { refType: "return", refId: request.id, actorUserId: input.actor.userId, reason: "Return request deleted" })
    }
    await tx.delete(returnRequests).where(eq(returnRequests.id, request.id))
    await audit(tx, input.actor, "return.delete", "return", request.id, { type: request.type, status: request.status, orderId: request.orderId })
    return request
  })
}
