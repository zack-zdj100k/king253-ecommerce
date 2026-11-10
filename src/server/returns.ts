import { and, asc, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm"
import { z } from "zod"

import type { Db, DbOrTx, Tx } from "./db/client"
import { orderItems, orderStatusHistory, orders, productImages, productVariants, products, returnJournal, returnJournalItems, stores } from "./db/schema"
import { audit, type Actor } from "./audit"
import { NotFoundError, RuleError } from "./errors"
import { handOverUnits, restockReturnedUnits, SELLS_SS } from "./inventory"
import { refundFor, unitPriceOf } from "./pricing"

/*
 * Returns & exchanges (admin only, on delivered orders), recorded in one
 * journal. Everything happens in one transaction:
 *   Return   → returned units back in stock (order's shop, or one the admin picks),
 *              money given back = what was paid for them; when every item is back
 *              the order's payment becomes "refused" and it leaves revenue/statistics.
 *   Exchange → returned units back in stock, new units out of the same shop's stock,
 *              difference = new items − returned items (+ collect / − refund).
 */

export const RETURN_REASONS = ["Wrong size", "Wrong colour", "Product issue", "Changed my mind", "Other"] as const

const line = z.object({ orderItemId: z.uuid(), quantity: z.coerce.number().int().min(1).max(100) })
const added = z.object({ variantId: z.uuid(), quantity: z.coerce.number().int().min(1).max(50) })
const base = {
  orderId: z.uuid(),
  /** Shop that receives the returned units (and gives the exchange units). Empty = the order's shop. */
  storeId: z.coerce.number().int().positive().nullable().optional(),
  returned: z.array(line).min(1, "Choose at least one item that comes back.").max(30),
  reason: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
}
export const returnInput = z.object(base)
export const exchangeInput = z.object({ ...base, added: z.array(added).min(1, "Choose at least one new item.").max(30) })
export type ReturnInput = z.input<typeof returnInput>
export type ExchangeInput = z.input<typeof exchangeInput>

async function lockDeliveredOrder(tx: Tx, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update")
  if (!order) throw new NotFoundError("This order")
  if (order.status !== "delivered") throw new RuleError("Returns and exchanges are only possible on delivered orders.")
  if (order.paymentStatus === "refused") throw new RuleError("Every item of this order has already come back.")
  return order
}

async function shopFor(tx: Tx, order: { storeId: number | null }, wanted: number | null | undefined) {
  const id = wanted ?? order.storeId
  if (!id) throw new RuleError("Choose the shop that receives the items.")
  const [shop] = await tx.select({ id: stores.id, name: stores.name, active: stores.active }).from(stores).where(eq(stores.id, id))
  if (!shop) throw new NotFoundError("This shop")
  return shop
}

/** Lock the returned items, check quantities, compute what the customer paid for them. */
async function takeBack(tx: Tx, order: typeof orders.$inferSelect, lines: z.infer<typeof line>[], storeId: number, journalId: string, ref: { refId: string; actorUserId: string | null; reason: string }) {
  const merged = new Map<string, number>()
  for (const l of lines) merged.set(l.orderItemId, (merged.get(l.orderItemId) ?? 0) + l.quantity)
  const items = await tx
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), inArray(orderItems.id, [...merged.keys()]), isNull(orderItems.removedAt)))
    .for("update")
  let value = 0
  for (const [itemId, qty] of merged) {
    const item = items.find((i) => i.id === itemId)
    if (!item) throw new NotFoundError("This order item")
    const left = item.quantity - item.returnedQuantity
    if (qty > left) throw new RuleError(`Only ${left} × ${item.productName} (${item.size}) can still come back.`)
    // Exchange items were given at their full price; original items at their share of the order discount.
    const paid = item.exchangeJournalId ? item.unitPrice * qty : refundFor(item, qty, order)
    value += paid
    await tx.update(orderItems).set({ returnedQuantity: item.returnedQuantity + qty }).where(eq(orderItems.id, item.id))
    if (item.variantId) {
      await restockReturnedUnits(tx, { variantId: item.variantId, storeId, quantity: qty, refType: "return", ...ref })
    }
    await tx.insert(returnJournalItems).values({
      journalId,
      direction: "in",
      orderItemId: item.id,
      variantId: item.variantId,
      productName: item.productName,
      size: item.size,
      color: item.color,
      quantity: qty,
      unitValue: Math.round(paid / qty),
    })
  }
  return value
}

/** True when every live item of the order (original or exchanged) has come back. */
async function everythingBack(tx: Tx, orderId: string) {
  const [row] = await tx
    .select({ open: sql<number>`count(*) filter (where ${orderItems.returnedQuantity} < ${orderItems.quantity})::int` })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNull(orderItems.removedAt)))
  return row.open === 0
}

async function history(tx: Tx, order: typeof orders.$inferSelect, actor: Actor, note: string) {
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: order.status,
    note,
    actorUserId: actor.userId,
    actorLabel: actor.label,
  })
}

export async function recordReturn(db: Db, raw: ReturnInput, actor: Actor) {
  const input = returnInput.parse(raw)
  return db.transaction(async (tx) => {
    const order = await lockDeliveredOrder(tx, input.orderId)
    const shop = await shopFor(tx, order, input.storeId)
    const [entry] = await tx
      .insert(returnJournal)
      .values({ orderId: order.id, storeId: shop.id, type: "return", amount: 0, reason: input.reason || null, note: input.note || null, actorUserId: actor.userId, actorLabel: actor.label })
      .returning()
    const ref = { refId: entry.id, actorUserId: actor.userId, reason: `Return on ${order.number}` }
    const refund = await takeBack(tx, order, input.returned, shop.id, entry.id, ref)
    const [saved] = await tx.update(returnJournal).set({ amount: -refund }).where(eq(returnJournal.id, entry.id)).returning()
    const full = await everythingBack(tx, order.id)
    if (full) await tx.update(orders).set({ paymentStatus: "refused" }).where(eq(orders.id, order.id))
    await history(tx, order, actor, `Return recorded — refund ${refund} DA${full ? " · every item is back: payment refused" : ""}`)
    await audit(tx, actor, "order.return", "order", order.id, { journal: entry.id, refund, full, shop: shop.name })
    return { ...saved, full }
  })
}

export async function recordExchange(db: Db, raw: ExchangeInput, actor: Actor) {
  const input = exchangeInput.parse(raw)
  return db.transaction(async (tx) => {
    const order = await lockDeliveredOrder(tx, input.orderId)
    const shop = await shopFor(tx, order, input.storeId)
    const [entry] = await tx
      .insert(returnJournal)
      .values({ orderId: order.id, storeId: shop.id, type: "exchange", amount: 0, reason: input.reason || null, note: input.note || null, actorUserId: actor.userId, actorLabel: actor.label })
      .returning()
    const ref = { refId: entry.id, actorUserId: actor.userId, reason: `Exchange on ${order.number}` }
    const returnedValue = await takeBack(tx, order, input.returned, shop.id, entry.id, ref)

    // New items: any active product/size the shop has in stock, at today's price.
    const wanted = new Map<string, number>()
    for (const a of input.added) wanted.set(a.variantId, (wanted.get(a.variantId) ?? 0) + a.quantity)
    const rows = await tx
      .select({
        variantId: productVariants.id,
        productId: products.id,
        productName: products.name,
        status: products.status,
        active: productVariants.active,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.color,
        price: products.price,
        salePrice: products.salePrice,
        priceOverride: productVariants.priceOverride,
        salePriceOverride: productVariants.salePriceOverride,
        imageUrl: sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = "products"."id"
          order by ${productImages.isMain} desc, ${productImages.sortOrder} asc limit 1)`,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, [...wanted.keys()]))
    let newValue = 0
    for (const [variantId, qty] of wanted) {
      const v = rows.find((r) => r.variantId === variantId)
      const price = v ? unitPriceOf(v, v) : null
      if (!v || !v.active || price === null) throw new RuleError("One of the new items can no longer be sold.")
      const label = `${v.productName} — ${v.color} / ${v.size}`
      await handOverUnits(tx, { variantId, storeId: shop.id, quantity: qty, label, refType: "return", ...ref })
      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: v.productId,
        variantId,
        productName: v.productName,
        sku: v.sku,
        size: v.size,
        color: v.color,
        imageUrl: v.imageUrl,
        unitPrice: price,
        quantity: qty,
        lineTotal: price * qty,
        exchangeJournalId: entry.id,
      })
      await tx.insert(returnJournalItems).values({
        journalId: entry.id,
        direction: "out",
        variantId,
        productName: v.productName,
        size: v.size,
        color: v.color,
        quantity: qty,
        unitValue: price,
      })
      newValue += price * qty
    }
    const difference = newValue - returnedValue
    const [saved] = await tx.update(returnJournal).set({ amount: difference }).where(eq(returnJournal.id, entry.id)).returning()
    const money = difference > 0 ? `to collect ${difference} DA` : difference < 0 ? `to refund ${-difference} DA` : "no difference"
    await history(tx, order, actor, `Exchange recorded — ${money}`)
    await audit(tx, actor, "order.exchange", "order", order.id, { journal: entry.id, returnedValue, newValue, difference, shop: shop.name })
    return saved
  })
}

/* ------------------------------------------------------------------ */
/* Reading the journal                                                */
/* ------------------------------------------------------------------ */

export type JournalFilter = { from?: Date; to?: Date; storeId?: number | null; type?: "return" | "exchange" | null; orderId?: string; page?: number }

export async function listJournal(db: DbOrTx, f: JournalFilter = {}) {
  // Totals cover both types for the period/shop; the list shows the chosen type.
  const scope: SQL[] = []
  if (f.from) scope.push(gte(returnJournal.createdAt, f.from))
  if (f.to) scope.push(lt(returnJournal.createdAt, f.to))
  if (f.storeId) scope.push(eq(returnJournal.storeId, f.storeId))
  if (f.orderId) scope.push(eq(returnJournal.orderId, f.orderId))
  const where = f.type ? [...scope, eq(returnJournal.type, f.type)] : scope
  const page = Math.max(1, f.page ?? 1)
  const rows = await db
    .select({
      entry: returnJournal,
      orderNumber: orders.number,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      shopName: stores.name,
      count: sql<number>`count(*) over()::int`,
    })
    .from(returnJournal)
    .innerJoin(orders, eq(orders.id, returnJournal.orderId))
    .leftJoin(stores, eq(stores.id, returnJournal.storeId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(returnJournal.createdAt))
    .limit(50)
    .offset((page - 1) * 50)
  const items = rows.length
    ? await db
        .select()
        .from(returnJournalItems)
        .where(inArray(returnJournalItems.journalId, rows.map((r) => r.entry.id)))
        .orderBy(asc(returnJournalItems.id))
    : []
  const [totals] = await db
    .select({
      returns: sql<number>`count(*) filter (where ${returnJournal.type} = 'return')::int`,
      exchanges: sql<number>`count(*) filter (where ${returnJournal.type} = 'exchange')::int`,
      refunded: sql<number>`coalesce(-sum(${returnJournal.amount}) filter (where ${returnJournal.amount} < 0), 0)::int`,
      collected: sql<number>`coalesce(sum(${returnJournal.amount}) filter (where ${returnJournal.amount} > 0), 0)::int`,
    })
    .from(returnJournal)
    .where(scope.length ? and(...scope) : undefined)
  const total = rows[0]?.count ?? 0
  return {
    rows: rows.map((r) => ({ ...r, items: items.filter((i) => i.journalId === r.entry.id) })),
    totals,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / 50)),
  }
}

/** Items of a delivered order that can still come back, with what was paid per unit. */
export async function returnableItems(db: DbOrTx, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  if (!order) return []
  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNull(orderItems.removedAt)))
    .orderBy(asc(orderItems.createdAt))
  return items
    .filter((i) => i.quantity > i.returnedQuantity)
    .map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productId: i.productId,
      image: i.imageUrl,
      name: i.productName,
      size: i.size,
      color: i.color,
      left: i.quantity - i.returnedQuantity,
      unitValue: i.exchangeJournalId ? i.unitPrice : refundFor(i, 1, order),
      fromExchange: Boolean(i.exchangeJournalId),
    }))
}

/** For the exchange picker: every sellable variant with its price and stock per active shop. */
export async function exchangeCatalog(db: DbOrTx) {
  const rows = await db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      price: products.price,
      salePrice: products.salePrice,
      priceOverride: productVariants.priceOverride,
      salePriceOverride: productVariants.salePriceOverride,
      stock: sql<{ storeId: number; available: number }[]>`(select coalesce(json_agg(json_build_object('storeId', ss.store_id,
        'available', greatest(ss.physical - ss.reserved, 0))), '[]') from store_stock ss join stores s on s.id = ss.store_id and s.active
        where ss.variant_id = "product_variants"."id" and ${sql.raw(SELLS_SS)})`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.active, true), eq(products.status, "published")))
    .orderBy(asc(products.name), asc(productVariants.color), asc(productVariants.sortOrder))
  return rows
    .map((r) => ({ variantId: r.variantId, label: `${r.productName} — ${r.color} / ${r.size}`, price: unitPriceOf(r, r), stock: r.stock }))
    .filter((r): r is typeof r & { price: number } => r.price !== null)
}
