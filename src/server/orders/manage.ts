import { and, eq, isNull, sql } from "drizzle-orm"

import type { Db, Tx } from "../db/client"
import {
  orderItems,
  orderStatusHistory,
  orders,
  productImages,
  productVariants,
  products,
  returnRequests,
  stockReservations,
} from "../db/schema"
import { audit, type Actor } from "../audit"
import { AppError, NotFoundError } from "../errors"
import { activeReservationsForItem, consumeReservation, releaseReservation, reserveStock } from "../inventory"
import { computeTotals, unitPriceOf, type DiscountInput } from "../pricing"
import { handOverDelivery } from "./delivery"

export const ORDER_STATUSES = [
  "pending",
  "contacting",
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "delivered",
  "cancelled",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  contacting: "Contacting",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_delivery: "Ready for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const CLOSED: OrderStatus[] = ["delivered", "cancelled"]

async function lockOrder(tx: Tx, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update")
  if (!order) throw new NotFoundError("This order")
  return order
}

function assertEditable(order: { status: OrderStatus; number: string }) {
  if (CLOSED.includes(order.status)) {
    throw new AppError("ORDER_CLOSED", `Order ${order.number} is ${STATUS_LABELS[order.status].toLowerCase()} and can no longer be changed.`)
  }
}

function liveItems(tx: Tx, orderId: string) {
  return tx
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNull(orderItems.removedAt)))
}

/* ------------------------------------------------------------------ */
/* Status                                                             */
/* ------------------------------------------------------------------ */

/**
 * Moves an order to a new status.
 *   cancelled → release reservations (physical stock untouched)
 *   delivered → consume reservations (physical and reserved both decrease)
 * Delivered and cancelled are final; returns go through return requests.
 */
export async function changeOrderStatus(
  db: Db,
  input: { orderId: string; to: OrderStatus; actor: Actor; note?: string | null }
) {
  if (!ORDER_STATUSES.includes(input.to)) throw new AppError("INVALID_STATUS", "Unknown order status.")

  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    if (order.status === input.to) return { order, changed: false }
    assertEditable(order)

    const ref = { refType: "order", refId: order.id, actorUserId: input.actor.userId, reason: `Order ${order.number} → ${STATUS_LABELS[input.to]}` }
    if (input.to === "cancelled" || input.to === "delivered") {
      for (const item of await liveItems(tx, order.id)) {
        const reservations = await activeReservationsForItem(tx, item.id)
        if (input.to === "delivered" && reservations.length === 0) {
          throw new AppError("NO_RESERVATION", `${item.productName} (${item.size}) has no reserved stock — check this order before delivering.`)
        }
        for (const r of reservations) {
          if (input.to === "cancelled") await releaseReservation(tx, r.id, ref)
          else await consumeReservation(tx, r.id, ref)
        }
      }
    }

    // A cancelled lead order passes its delivery (fee) to the next order shipping with it.
    if (input.to === "cancelled") await handOverDelivery(tx, order)

    const now = new Date()
    const [updated] = await tx
      .update(orders)
      .set({
        status: input.to,
        deliveredAt: input.to === "delivered" ? now : order.deliveredAt,
        cancelledAt: input.to === "cancelled" ? now : order.cancelledAt,
      })
      .where(eq(orders.id, order.id))
      .returning()

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: input.to,
      note: input.note?.trim() || null,
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
    })
    await audit(tx, input.actor, "order.status", "order", order.id, { from: order.status, to: input.to, note: input.note ?? null })
    return { order: updated, changed: true, previous: order.status }
  })
}

/* ------------------------------------------------------------------ */
/* Totals                                                             */
/* ------------------------------------------------------------------ */

async function recomputeTotals(tx: Tx, orderId: string, overrides: { deliveryFee?: number; freeDelivery?: boolean; discount?: DiscountInput } = {}) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId))
  const [{ subtotal }] = await tx
    .select({ subtotal: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)::int` })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNull(orderItems.removedAt)))

  const deliveryFee = overrides.deliveryFee ?? order.deliveryFee
  const discount = overrides.discount ?? { type: order.discountType, value: order.discountValue }
  const freeDelivery = overrides.freeDelivery ?? order.freeDelivery
  const { discountAmount, total } = computeTotals({ subtotal, deliveryFee, discount, freeDelivery })

  const [updated] = await tx
    .update(orders)
    .set({
      subtotal,
      deliveryFee,
      freeDelivery,
      discountType: discount.type,
      discountValue: discount.type ? discount.value : 0,
      discountAmount,
      total,
    })
    .where(eq(orders.id, orderId))
    .returning()
  return updated
}

/* ------------------------------------------------------------------ */
/* Items                                                              */
/* ------------------------------------------------------------------ */

async function loadVariantForOrder(tx: Tx, variantId: string) {
  const [row] = await tx
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productStatus: products.status,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      active: productVariants.active,
      priceOverride: productVariants.priceOverride,
      salePriceOverride: productVariants.salePriceOverride,
      price: products.price,
      salePrice: products.salePrice,
      imageUrl: sql<string | null>`(
        select ${productImages.url} from ${productImages}
        where ${productImages.productId} = "products"."id"
        order by case when ${productImages.color} = "product_variants"."color" then 0 when ${productImages.color} is null then 1 else 2 end,
          ${productImages.isMain} desc, ${productImages.sortOrder} asc limit 1)`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId))
  if (!row || !row.active || row.productStatus === "archived") throw new AppError("UNAVAILABLE", "That product option is not available.")
  const unitPrice = unitPriceOf(row, row)
  if (unitPrice === null) throw new AppError("UNAVAILABLE", `${row.productName} has no price yet.`)
  return { ...row, unitPrice }
}

/**
 * Change an item's variant and/or quantity. The old reservation is released
 * and the new one reserved in the same transaction — e.g. Black/M × 2 → Black/L × 2.
 */
export async function updateOrderItem(
  db: Db,
  input: { orderId: string; itemId: string; variantId: string; quantity: number; actor: Actor }
) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) {
    throw new AppError("INVALID_QUANTITY", "Quantity must be between 1 and 50.")
  }
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    assertEditable(order)
    const [item] = await tx
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.id, input.itemId), eq(orderItems.orderId, order.id), isNull(orderItems.removedAt)))
    if (!item) throw new NotFoundError("This order item")
    if (item.variantId === input.variantId && item.quantity === input.quantity) return order

    const ref = { refType: "order", refId: order.id, actorUserId: input.actor.userId, reason: `Edit ${order.number}` }
    for (const r of await activeReservationsForItem(tx, item.id)) await releaseReservation(tx, r.id, ref)

    const variantChanged = item.variantId !== input.variantId
    const next = variantChanged ? await loadVariantForOrder(tx, input.variantId) : null
    await reserveStock(tx, {
      variantId: input.variantId,
      quantity: input.quantity,
      orderItemId: item.id,
      label: next ? `${next.productName} — ${next.color} / ${next.size}` : `${item.productName} — ${item.color} / ${item.size}`,
      ...ref,
    })

    // Same variant keeps the agreed unit price; a new variant takes its current price.
    const unitPrice = next ? next.unitPrice : item.unitPrice
    await tx
      .update(orderItems)
      .set({
        variantId: input.variantId,
        quantity: input.quantity,
        unitPrice,
        lineTotal: unitPrice * input.quantity,
        ...(next
          ? { productId: next.productId, productName: next.productName, sku: next.sku, size: next.size, color: next.color, imageUrl: next.imageUrl }
          : {}),
      })
      .where(eq(orderItems.id, item.id))

    const updated = await recomputeTotals(tx, order.id)
    await audit(tx, input.actor, "order.item.update", "order", order.id, {
      itemId: item.id,
      before: { sku: item.sku, size: item.size, color: item.color, quantity: item.quantity },
      after: { sku: next?.sku ?? item.sku, size: next?.size ?? item.size, color: next?.color ?? item.color, quantity: input.quantity },
    })
    return updated
  })
}

export async function addOrderItem(db: Db, input: { orderId: string; variantId: string; quantity: number; actor: Actor }) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) {
    throw new AppError("INVALID_QUANTITY", "Quantity must be between 1 and 50.")
  }
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    assertEditable(order)
    const v = await loadVariantForOrder(tx, input.variantId)
    const [item] = await tx
      .insert(orderItems)
      .values({
        orderId: order.id,
        productId: v.productId,
        variantId: v.variantId,
        productName: v.productName,
        sku: v.sku,
        size: v.size,
        color: v.color,
        imageUrl: v.imageUrl,
        unitPrice: v.unitPrice,
        quantity: input.quantity,
        lineTotal: v.unitPrice * input.quantity,
      })
      .returning({ id: orderItems.id })
    await reserveStock(tx, {
      variantId: v.variantId,
      quantity: input.quantity,
      orderItemId: item.id,
      label: `${v.productName} — ${v.color} / ${v.size}`,
      refType: "order",
      refId: order.id,
      actorUserId: input.actor.userId,
      reason: `Edit ${order.number}`,
    })
    const updated = await recomputeTotals(tx, order.id)
    await audit(tx, input.actor, "order.item.add", "order", order.id, { sku: v.sku, quantity: input.quantity })
    return updated
  })
}

/** Soft-removes an item (kept for history) and releases its reservation. */
export async function removeOrderItem(db: Db, input: { orderId: string; itemId: string; actor: Actor }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    assertEditable(order)
    const items = await liveItems(tx, order.id)
    const item = items.find((i) => i.id === input.itemId)
    if (!item) throw new NotFoundError("This order item")
    if (items.length === 1) throw new AppError("LAST_ITEM", "An order needs at least one item. Cancel the order instead.")

    const ref = { refType: "order", refId: order.id, actorUserId: input.actor.userId, reason: `Edit ${order.number}` }
    for (const r of await activeReservationsForItem(tx, item.id)) await releaseReservation(tx, r.id, ref)
    await tx.update(orderItems).set({ removedAt: new Date() }).where(eq(orderItems.id, item.id))

    const updated = await recomputeTotals(tx, order.id)
    await audit(tx, input.actor, "order.item.remove", "order", order.id, { sku: item.sku, quantity: item.quantity })
    return updated
  })
}

/* ------------------------------------------------------------------ */
/* Delivery, discount, notes                                          */
/* ------------------------------------------------------------------ */

export async function updateOrderDelivery(
  db: Db,
  input: {
    orderId: string
    wilaya: string
    city: string
    address: string
    /** Admin sets the fee per order (agreed with the delivery company). */
    deliveryFee: number
    /** The shop pays the courier; the customer pays only the clothes. */
    freeDelivery?: boolean
    actor: Actor
  }
) {
  const wilaya = input.wilaya.trim()
  const city = input.city.trim()
  const address = input.address.trim()
  if (wilaya.length < 2 || city.length < 2 || address.length < 4) {
    throw new AppError("INVALID_ADDRESS", "Enter a wilaya, a city and a street address.")
  }
  if (!Number.isInteger(input.deliveryFee) || input.deliveryFee < 0) {
    throw new AppError("INVALID_FEE", "Delivery fee must be 0 or more.")
  }
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    assertEditable(order)
    await tx.update(orders).set({ wilayaName: wilaya, city, address }).where(eq(orders.id, order.id))
    const updated = await recomputeTotals(tx, order.id, { deliveryFee: input.deliveryFee, freeDelivery: input.freeDelivery ?? order.freeDelivery })
    await audit(tx, input.actor, "order.delivery.update", "order", order.id, {
      before: { wilaya: order.wilayaName, city: order.city, address: order.address, fee: order.deliveryFee, free: order.freeDelivery },
      after: { wilaya, city, address, fee: input.deliveryFee, free: input.freeDelivery ?? order.freeDelivery },
    })
    return updated
  })
}

/** Negotiated discount — validated server-side against the subtotal. */
export async function applyOrderDiscount(db: Db, input: { orderId: string; discount: DiscountInput; actor: Actor }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    assertEditable(order)
    const updated = await recomputeTotals(tx, order.id, { discount: input.discount })
    await audit(tx, input.actor, "order.discount", "order", order.id, {
      before: { type: order.discountType, value: order.discountValue, amount: order.discountAmount },
      after: { type: updated.discountType, value: updated.discountValue, amount: updated.discountAmount },
    })
    return updated
  })
}

export async function setOrderAdminNotes(db: Db, input: { orderId: string; notes: string; actor: Actor }) {
  const notes = input.notes.trim().slice(0, 4000)
  const [updated] = await db.update(orders).set({ adminNotes: notes || null }).where(eq(orders.id, input.orderId)).returning()
  if (!updated) throw new NotFoundError("This order")
  await audit(db, input.actor, "order.notes", "order", input.orderId, {})
  return updated
}

/* ------------------------------------------------------------------ */
/* Delete                                                             */
/* ------------------------------------------------------------------ */

/**
 * Permanently removes an order. Reserved units of an open order go back to
 * "available" first; delivered stock is not touched (the units left the shop).
 * Items, history, returns and notifications are removed with it (cascade).
 */
export async function deleteOrder(db: Db, input: { orderId: string; actor: Actor }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    const ref = { refType: "order", refId: order.id, actorUserId: input.actor.userId, reason: `Order ${order.number} deleted` }
    const items = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, order.id))
    for (const item of items) {
      for (const r of await activeReservationsForItem(tx, item.id)) await releaseReservation(tx, r.id, ref)
    }
    // Exchange reservations held by this order's return requests.
    const exchangeHolds = await tx
      .select({ id: stockReservations.id })
      .from(stockReservations)
      .innerJoin(returnRequests, eq(returnRequests.id, stockReservations.returnRequestId))
      .where(and(eq(returnRequests.orderId, order.id), eq(stockReservations.status, "active")))
    for (const r of exchangeHolds) await releaseReservation(tx, r.id, ref)

    await handOverDelivery(tx, order)
    await tx.delete(orders).where(eq(orders.id, order.id))
    await audit(tx, input.actor, "order.delete", "order", order.id, {
      number: order.number,
      status: order.status,
      customer: order.customerName,
      phone: order.customerPhone,
      total: order.total,
    })
    return order
  })
}
