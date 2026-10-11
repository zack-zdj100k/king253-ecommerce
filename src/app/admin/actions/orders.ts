"use server"

import { and, eq, ilike, or, sql } from "drizzle-orm"
import { after } from "next/server"
import { z } from "zod"

import { db } from "@/server/db"
import { productVariants, products } from "@/server/db/schema"
import { sendStatusEmail } from "@/server/email/send"
import { effectivePriceSql } from "@/server/pricing"
import {
  addOrderItem,
  applyOrderDiscount,
  changeOrderStatus,
  deleteOrder,
  ORDER_STATUSES,
  removeOrderItem,
  setOrderAdminNotes,
  updateOrderDelivery,
  updateOrderItem,
} from "@/server/orders/manage"
import { requireAdmin } from "@/server/auth/session"
import { adminAction } from "./_shared"

const id = z.uuid()

export async function changeStatusAction(orderId: string, to: string, note: string) {
  return adminAction(
    async ({ actor }) => {
      const status = z.enum(ORDER_STATUSES).parse(to)
      const result = await changeOrderStatus(db, { orderId: id.parse(orderId), to: status, actor, note: note.slice(0, 500) })
      if (result.changed) after(() => sendStatusEmail(db, result.order.id, status).catch((e) => console.error("[king253] status email", e)))
    },
    { revalidate: [`/admin/orders/${orderId}`, "/admin/orders", "/admin"], message: "Status updated." }
  )
}

export async function updateItemAction(orderId: string, itemId: string, variantId: string, quantity: number) {
  return adminAction(
    async ({ actor }) => {
      await updateOrderItem(db, { orderId: id.parse(orderId), itemId: id.parse(itemId), variantId: id.parse(variantId), quantity: z.number().int().parse(quantity), actor })
    },
    { revalidate: [`/admin/orders/${orderId}`], message: "Item updated and stock moved." }
  )
}

export async function addItemAction(orderId: string, variantId: string, quantity: number) {
  return adminAction(
    async ({ actor }) => {
      await addOrderItem(db, { orderId: id.parse(orderId), variantId: id.parse(variantId), quantity: z.number().int().parse(quantity), actor })
    },
    { revalidate: [`/admin/orders/${orderId}`], message: "Item added and reserved." }
  )
}

export async function removeItemAction(orderId: string, itemId: string) {
  return adminAction(
    async ({ actor }) => {
      await removeOrderItem(db, { orderId: id.parse(orderId), itemId: id.parse(itemId), actor })
    },
    { revalidate: [`/admin/orders/${orderId}`], message: "Item removed and stock released." }
  )
}

const deliveryInput = z.object({
  wilaya: z.string().max(80),
  city: z.string().max(120),
  address: z.string().max(300),
  deliveryFee: z.coerce.number("Delivery fee must be a number.").int("Use whole dinars.").min(0, "Delivery fee must be 0 or more."),
  freeDelivery: z.boolean().optional(),
})

export async function updateDeliveryAction(orderId: string, raw: unknown) {
  return adminAction(
    async ({ actor }) => {
      const input = deliveryInput.parse(raw)
      await updateOrderDelivery(db, { orderId: id.parse(orderId), ...input, actor })
    },
    { revalidate: [`/admin/orders/${orderId}`], message: "Delivery updated." }
  )
}

/** Permanent. Reserved units of an open order are released first. */
export async function deleteOrderAction(orderId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteOrder(db, { orderId: id.parse(orderId), actor })
    },
    { revalidate: ["/admin/orders", "/admin", "/admin/inventory", "/admin/customers", "/admin/returns"], message: "Order deleted." }
  )
}

export async function applyDiscountAction(orderId: string, type: "fixed" | "percent" | null, value: number) {
  return adminAction(
    async ({ actor }) => {
      const parsed = z
        .object({ type: z.enum(["fixed", "percent"]).nullable(), value: z.number().int().min(0) })
        .parse({ type, value })
      await applyOrderDiscount(db, { orderId: id.parse(orderId), discount: parsed, actor })
    },
    { revalidate: [`/admin/orders/${orderId}`], message: "Discount applied." }
  )
}

export async function saveNotesAction(orderId: string, notes: string) {
  return adminAction(
    async ({ actor }) => {
      await setOrderAdminNotes(db, { orderId: id.parse(orderId), notes: String(notes), actor })
    },
    { revalidate: [`/admin/orders/${orderId}`], message: "Notes saved." }
  )
}

/** Variant search for adding items to an order. */
export async function searchVariantsAction(q: string) {
  await requireAdmin()
  const term = String(q).trim().slice(0, 60)
  if (term.length < 2) return []
  const pat = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      available: sql<number>`greatest(${productVariants.physical} - ${productVariants.reserved}, 0)::int`,
      name: products.name,
      price: sql<number | null>`${effectivePriceSql('"product_variants"', '"products"')}`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.active, true), sql`${products.status} <> 'archived'`, or(ilike(products.name, pat), ilike(productVariants.sku, pat))))
    .limit(20)
}
