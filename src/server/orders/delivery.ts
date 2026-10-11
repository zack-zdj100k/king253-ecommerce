import { and, asc, eq, isNull, notInArray, sql } from "drizzle-orm"

import type { Tx } from "../db/client"
import { orders } from "../db/schema"
import { qualifiesForFreeDelivery } from "../pricing"

/*
 * One delivery per customer and address until it is delivered.
 * If the same customer (phone) orders again to the same wilaya + commune while
 * an earlier order is still open, the new order "ships with" it: one parcel,
 * one delivery fee, charged on the first (lead) order only. Once an order is
 * delivered (or cancelled) a new order is a new delivery and pays again.
 */

const CLOSED = ["delivered", "cancelled"] as const

/** The open lead order this customer's new order should ship with, locked for update. */
export async function findOpenDelivery(tx: Tx, who: { phone: string; wilaya: string; city: string }) {
  const [lead] = await tx
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.customerPhone, who.phone),
        eq(orders.wilayaName, who.wilaya),
        eq(orders.city, who.city),
        isNull(orders.shipsWithOrderId),
        notInArray(orders.status, [...CLOSED])
      )
    )
    .orderBy(asc(orders.createdAt))
    .limit(1)
    .for("update")
  return lead ?? null
}

/** total = clothes + delivery (unless free). Recalculated from the stored parts. */
export async function refreshTotal(tx: Tx, orderId: string) {
  const [row] = await tx
    .update(orders)
    .set({ total: sql`${orders.subtotal} - ${orders.discountAmount} + case when ${orders.freeDelivery} then 0 else ${orders.deliveryFee} end` })
    .where(eq(orders.id, orderId))
    .returning()
  return row
}

/** Clothes total of a whole delivery (lead + open orders shipping with it). */
export async function deliveryClothesTotal(tx: Tx, leadId: string) {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${orders.subtotal} - ${orders.discountAmount}), 0)::int` })
    .from(orders)
    .where(and(sql`(${orders.id} = ${leadId} or ${orders.shipsWithOrderId} = ${leadId})`, notInArray(orders.status, ["cancelled"])))
  return row.total
}

/** When the joined parcel reaches the free-delivery threshold, the lead order becomes free. */
export async function applyFreeDeliveryPromo(tx: Tx, leadId: string, settings: { freeDelivery: boolean; freeDeliveryMin: number }) {
  if (!settings.freeDelivery) return
  if (qualifiesForFreeDelivery(settings, await deliveryClothesTotal(tx, leadId))) {
    await tx.update(orders).set({ freeDelivery: true }).where(eq(orders.id, leadId))
    await refreshTotal(tx, leadId)
  }
}

/**
 * The lead order is cancelled or deleted while other orders ship with it:
 * the earliest open one takes over the delivery (fee and free-delivery status).
 */
export async function handOverDelivery(tx: Tx, lead: typeof orders.$inferSelect) {
  if (lead.shipsWithOrderId) return null
  const followers = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.shipsWithOrderId, lead.id), notInArray(orders.status, [...CLOSED])))
    .orderBy(asc(orders.createdAt))
    .for("update")
  if (!followers.length) return null
  const [next, ...rest] = followers
  await tx
    .update(orders)
    .set({ shipsWithOrderId: null, deliveryFee: lead.deliveryFee, freeDelivery: lead.freeDelivery })
    .where(eq(orders.id, next.id))
  await refreshTotal(tx, next.id)
  for (const o of rest) await tx.update(orders).set({ shipsWithOrderId: next.id }).where(eq(orders.id, o.id))
  return next
}
