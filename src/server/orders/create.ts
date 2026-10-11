import { randomBytes } from "node:crypto"

import { and, eq, inArray, sql } from "drizzle-orm"

import type { Db } from "../db/client"
import {
  analyticsEvents,
  cartItems,
  carts,
  orderItems,
  orderStatusHistory,
  orders,
  productImages,
  productVariants,
  products,
} from "../db/schema"
import { upsertCustomerByPhone } from "../customers"
import { AppError } from "../errors"
import { reserveStock } from "../inventory"
import { computeTotals, qualifiesForFreeDelivery, unitPriceOf } from "../pricing"
import { applyFreeDeliveryPromo, findOpenDelivery } from "./delivery"
import { getSettings } from "../settings"
import { createOrderSchema, fieldErrors, type CreateOrderInput } from "../validation"
import { algiersDay, nextOrderNumber } from "./number"

export class ValidationError extends AppError {
  constructor(public readonly fields: Record<string, string>) {
    super("VALIDATION", "Please check the highlighted fields.")
  }
}

export type CreateOrderContext = {
  userId?: string | null
  cartId?: string | null
  sessionId?: string | null
}

export type CreatedOrder = typeof orders.$inferSelect & { created: boolean }

function isUniqueViolation(error: unknown, constraint: string) {
  const e = error as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } }
  const pg = e?.cause?.code ? e.cause : e
  return pg?.code === "23505" && pg?.constraint_name === constraint
}

/**
 * Creates ONE order for all lines (Buy Now = one line, Buy All = the bag).
 * Prices, delivery fee and totals are computed here from the database; the
 * client only says which variants and how many. Stock is reserved atomically.
 */
export async function createOrder(db: Db, input: CreateOrderInput, ctx: CreateOrderContext = {}): Promise<CreatedOrder> {
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError(fieldErrors(parsed.error))
  const { customer, idempotencyKey } = parsed.data

  // Duplicate submit (double click, refresh, retry) → same order.
  const existing = await db.query.orders.findFirst({ where: eq(orders.idempotencyKey, idempotencyKey) })
  if (existing) return { ...existing, created: false }

  // Merge duplicate lines for the same variant.
  const quantities = new Map<string, number>()
  for (const line of parsed.data.lines) quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity)

  const rows = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      priceOverride: productVariants.priceOverride,
      salePriceOverride: productVariants.salePriceOverride,
      variantActive: productVariants.active,
      productId: products.id,
      productName: products.name,
      productStatus: products.status,
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
    .where(inArray(productVariants.id, [...quantities.keys()]))

  const lines = [...quantities.entries()].map(([variantId, quantity]) => {
    const row = rows.find((r) => r.variantId === variantId)
    if (!row || !row.variantActive || row.productStatus !== "published") {
      throw new AppError("UNAVAILABLE", `${row?.productName ?? "An item in your bag"} is no longer available.`)
    }
    const unitPrice = unitPriceOf(row, row)
    if (unitPrice === null) throw new AppError("UNAVAILABLE", `${row.productName} cannot be ordered yet.`)
    return { ...row, quantity, unitPrice, lineTotal: unitPrice * quantity, label: `${row.productName} — ${row.color} / ${row.size}` }
  })

  // One delivery fee for all of Algeria (admin can still adjust per order).
  const settings = await getSettings(db)
  const { deliveryEstimate, orderPrefix: prefix } = settings
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)

  try {
    const order = await db.transaction(async (tx) => {
      const customerId = await upsertCustomerByPhone(tx, customer)
      const number = await nextOrderNumber(tx, prefix)

      // Ordered again before the earlier parcel was delivered → same delivery, no second fee.
      const lead = await findOpenDelivery(tx, { phone: customer.phone, wilaya: customer.wilaya, city: customer.city })
      const deliveryFee = lead ? 0 : settings.deliveryFee
      const freeDelivery = lead ? false : qualifiesForFreeDelivery(settings, subtotal)
      const { discountAmount, total } = computeTotals({ subtotal, deliveryFee, discount: { type: null, value: 0 }, freeDelivery })

      const [created] = await tx
        .insert(orders)
        .values({
          number,
          idempotencyKey,
          accessToken: randomBytes(24).toString("base64url"),
          customerId,
          userId: ctx.userId ?? null,
          status: "pending",
          paymentMethod: "cod",
          customerName: customer.fullName,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          customerAge: customer.age,
          wilayaName: customer.wilaya,
          city: customer.city,
          address: customer.address,
          estimatedDays: deliveryEstimate || null,
          deliveryFee,
          freeDelivery,
          shipsWithOrderId: lead?.id ?? null,
          subtotal,
          discountAmount,
          total,
          customerNotes: customer.notes,
          cartId: ctx.cartId ?? null,
        })
        .returning()

      for (const line of lines) {
        const [item] = await tx
          .insert(orderItems)
          .values({
            orderId: created.id,
            productId: line.productId,
            variantId: line.variantId,
            productName: line.productName,
            sku: line.sku,
            size: line.size,
            color: line.color,
            imageUrl: line.imageUrl,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          })
          .returning({ id: orderItems.id })

        await reserveStock(tx, {
          variantId: line.variantId,
          quantity: line.quantity,
          orderItemId: item.id,
          label: line.label,
          refType: "order",
          refId: created.id,
          reason: `Order ${number}`,
        })
      }

      if (lead) await applyFreeDeliveryPromo(tx, lead.id, settings)

      await tx.insert(orderStatusHistory).values({
        orderId: created.id,
        fromStatus: null,
        toStatus: "pending",
        actorLabel: "Customer",
        actorUserId: ctx.userId ?? null,
        note: lead ? `Order placed — cash on delivery · ships with ${lead.number} (one delivery)` : "Order placed — cash on delivery",
      })

      await tx.insert(analyticsEvents).values(
        lines.map((l) => ({
          type: "purchase",
          sessionId: ctx.sessionId ?? null,
          productId: l.productId,
          variantId: l.variantId,
          orderId: created.id,
          quantity: l.quantity,
          day: algiersDay(),
        }))
      )

      if (ctx.cartId) {
        await tx.update(carts).set({ orderId: created.id, lastActivityAt: new Date() }).where(eq(carts.id, ctx.cartId))
        await tx
          .delete(cartItems)
          .where(and(eq(cartItems.cartId, ctx.cartId), inArray(cartItems.variantId, lines.map((l) => l.variantId))))
      }

      return created
    })
    return { ...order, created: true }
  } catch (error) {
    // Two identical submits raced: the loser returns the winner's order.
    if (isUniqueViolation(error, "orders_idempotency_unique")) {
      const winner = await db.query.orders.findFirst({ where: eq(orders.idempotencyKey, idempotencyKey) })
      if (winner) return { ...winner, created: false }
    }
    throw error
  }
}
