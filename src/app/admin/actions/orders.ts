"use server"

import { and, eq, ilike, or, sql } from "drizzle-orm"
import { after } from "next/server"
import { z } from "zod"

import { db } from "@/server/db"
import { orders, productVariants, products } from "@/server/db/schema"
import { SELLS_SS } from "@/server/inventory"
import { sendStatusEmail } from "@/server/email/send"
import { effectivePriceSql } from "@/server/pricing"
import {
  addOrderItem,
  applyOrderDiscount,
  changeOrderStatus,
  deleteOrder,
  FLOW_STATUSES,
  setOrderStatusManually,
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

/** Any status, also backwards (stock follows). Used by "Change status by hand". */
export async function setStatusManuallyAction(orderId: string, to: string, note: string) {
  return adminAction(
    async ({ actor }) => {
      const status = z.enum(FLOW_STATUSES).parse(to)
      const result = await setOrderStatusManually(db, { orderId: id.parse(orderId), to: status, actor, note: note.slice(0, 500) })
      if (result.changed && status === "delivered") after(() => sendStatusEmail(db, result.order.id, status).catch((e) => console.error("[king253] status email", e)))
    },
    { revalidate: [`/admin/orders/${orderId}`, "/admin/orders", "/admin", "/admin/inventory"], message: "Status changed. Stock updated." }
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

/**
 * Variant search for adding items to an order: by name / SKU / barcode and/or by
 * category (a main category includes its subcategories). Stock is the order's
 * departure shop, because the new item is reserved there.
 */
export async function searchVariantsAction(input: { orderId: string; q?: string; categoryId?: number | null }) {
  await requireAdmin()
  const orderId = id.parse(input.orderId)
  const term = String(input.q ?? "").trim().slice(0, 60)
  const categoryId = input.categoryId ? z.number().int().parse(input.categoryId) : null
  if (term.length < 2 && !categoryId) return []
  const [order] = await db.select({ storeId: orders.storeId }).from(orders).where(eq(orders.id, orderId))
  const storeId = order?.storeId ?? 0
  const pat = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const where = [eq(productVariants.active, true), sql`${products.status} <> 'archived'`]
  if (term.length >= 2) where.push(or(ilike(products.name, pat), ilike(productVariants.sku, pat), ilike(productVariants.barcode, pat))!)
  if (categoryId) where.push(sql`(${products.categoryId} = ${categoryId} or ${products.categoryId} in (select c.id from categories c where c.parent_id = ${categoryId}))`)
  return db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      colorHex: productVariants.colorHex,
      name: products.name,
      category: sql<string | null>`(select c.name from categories c where c.id = ${products.categoryId})`,
      parentCategory: sql<string | null>`(select pc.name from categories c join categories pc on pc.id = c.parent_id where c.id = ${products.categoryId})`,
      image: sql<string | null>`(select i.url from product_images i where i.product_id = ${products.id}
        order by (i.color = ${productVariants.color}) desc nulls last, i.is_main desc, i.sort_order limit 1)`,
      available: sql<number>`coalesce((select greatest(ss.physical - ss.reserved, 0) from store_stock ss
        where ss.variant_id = ${productVariants.id} and ss.store_id = ${storeId} and ${sql.raw(SELLS_SS)}), 0)::int`,
      price: sql<number | null>`${effectivePriceSql('"product_variants"', '"products"')}`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(...where))
    // In stock in this shop first, then by name.
    .orderBy(sql`(select greatest(ss.physical - ss.reserved, 0) from store_stock ss where ss.variant_id = ${productVariants.id} and ss.store_id = ${storeId}) > 0 desc nulls last`, products.name, productVariants.color, productVariants.sortOrder)
    .limit(60)
}
