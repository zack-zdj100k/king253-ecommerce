import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import {
  analyticsEvents,
  cartItems,
  carts,
  checkoutProfiles,
  orderItems,
  orders,
  productVariants,
  products,
} from "./db/schema"
import { effectivePriceSql, netRevenueSql, refundsSql, unitPriceOf } from "./pricing"

/** Shop revenue per order: clothes, minus delivery the shop pays (free delivery). Delivery fees are not revenue. */
const NET = netRevenueSql('"orders"')
import { algiersDay } from "./orders/number"

export type EventType = "product_view" | "add_to_cart" | "checkout_start" | "purchase"

/** Fire-and-forget analytics; views are de-duplicated per session/product/day. */
export async function recordEvent(
  db: DbOrTx,
  e: { type: EventType; sessionId?: string | null; productId?: string | null; variantId?: string | null; quantity?: number | null }
) {
  await db
    .insert(analyticsEvents)
    .values({
      type: e.type,
      sessionId: e.sessionId ?? null,
      productId: e.productId ?? null,
      variantId: e.variantId ?? null,
      quantity: e.quantity ?? null,
      day: algiersDay().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    })
    .onConflictDoNothing()
}

export type Range = { from: Date; to: Date }

/** Dashboard numbers — all straight from the database. */
export async function getAnalytics(db: DbOrTx, range: Range) {
  const inRange = and(gte(orders.createdAt, range.from), lt(orders.createdAt, range.to))
  const live = sql`${orders.status} <> 'cancelled'`

  const [summary] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      liveOrders: sql<number>`count(*) filter (where ${live})::int`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
      pending: sql<number>`count(*) filter (where ${orders.status} not in ('delivered','cancelled'))::int`,
      bookedRevenue: sql<number>`coalesce(sum(${NET}) filter (where ${live}), 0)::int`,
      deliveredRevenue: sql<number>`coalesce(sum(${NET}) filter (where ${orders.status} = 'delivered'), 0)::int`,
      // The parts of the net figure, so the dashboard can explain it.
      sales: sql<number>`coalesce(sum(${orders.subtotal} - ${orders.discountAmount}) filter (where ${live}), 0)::int`,
      refunds: sql<number>`coalesce(sum(${sql.raw(refundsSql('"orders"'))}) filter (where ${live}), 0)::int`,
      deliveryPaid: sql<number>`coalesce(sum(case when ${orders.freeDelivery} then ${orders.deliveryFee} else 0 end) filter (where ${live}), 0)::int`,
    })
    .from(orders)
    .where(inRange)

  const [items] = await db
    .select({
      // Units kept by customers: completed returns are not sales.
      units: sql<number>`coalesce(sum(${orderItems.quantity} - coalesce((select sum(r.quantity) from return_requests r
        where r.order_item_id = ${orderItems.id} and r.type = 'return' and r.status = 'completed'), 0)), 0)::int`,
      ordered: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(inRange, live, isNull(orderItems.removedAt)))

  const eventsInRange = and(gte(analyticsEvents.createdAt, range.from), lt(analyticsEvents.createdAt, range.to))
  const [sessions] = await db
    .select({
      viewers: sql<number>`count(distinct ${analyticsEvents.sessionId}) filter (where ${analyticsEvents.type} = 'product_view')::int`,
      buyers: sql<number>`count(distinct ${analyticsEvents.sessionId}) filter (where ${analyticsEvents.type} = 'purchase')::int`,
    })
    .from(analyticsEvents)
    .where(eventsInRange)

  const topProducts = (type: EventType, metric: "count" | "quantity") =>
    db
      .select({
        productId: analyticsEvents.productId,
        name: products.name,
        slug: products.slug,
        value: metric === "count" ? sql<number>`count(*)::int` : sql<number>`coalesce(sum(${analyticsEvents.quantity}), 0)::int`,
      })
      .from(analyticsEvents)
      .innerJoin(products, eq(products.id, analyticsEvents.productId))
      .where(and(eventsInRange, eq(analyticsEvents.type, type)))
      .groupBy(analyticsEvents.productId, products.name, products.slug)
      .orderBy(desc(sql`3`))
      .limit(5)

  const [mostViewed, mostAdded, mostPurchased, topWilayas, byDay] = await Promise.all([
    topProducts("product_view", "count"),
    topProducts("add_to_cart", "quantity"),
    topProducts("purchase", "quantity"),
    db
      // Wilaya is typed by the customer — group "alger", "Alger " and "ALGER" together.
      .select({ name: sql<string>`initcap(lower(trim(${orders.wilayaName})))`, orders: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(${NET}),0)::int` })
      .from(orders)
      .where(and(inRange, live))
      .groupBy(sql`1`)
      .orderBy(desc(sql`2`))
      .limit(6),
    db
      .select({
        day: sql<string>`to_char(${orders.createdAt} at time zone 'Africa/Algiers', 'YYYY-MM-DD')`,
        orders: sql<number>`count(*) filter (where ${live})::int`,
        revenue: sql<number>`coalesce(sum(${NET}) filter (where ${live}), 0)::int`,
        sales: sql<number>`coalesce(sum(${orders.subtotal} - ${orders.discountAmount}) filter (where ${live}), 0)::int`,
      })
      .from(orders)
      .where(inRange)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ])
  const [unitsByDay, previous] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${orders.createdAt} at time zone 'Africa/Algiers', 'YYYY-MM-DD')`,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(inRange, live, isNull(orderItems.removedAt)))
      .groupBy(sql`1`),
    // Same-length period just before, for the "vs previous period" badges.
    periodTotals(db, { from: new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime())), to: range.from }),
  ])

  const liveOrders = summary.liveOrders
  return {
    ...summary,
    units: items.units,
    returnedUnits: items.ordered - items.units,
    // Basket size is measured on what was ordered (before returns), so it stays meaningful.
    averageOrderValue: liveOrders ? Math.round(summary.sales / liveOrders) : 0,
    itemsPerOrder: liveOrders ? Math.round((items.ordered / liveOrders) * 10) / 10 : 0,
    viewers: sessions.viewers,
    conversionRate: sessions.viewers ? Math.round((sessions.buyers / sessions.viewers) * 1000) / 10 : null,
    mostViewed,
    mostAdded,
    mostPurchased,
    topWilayas,
    byDay: byDay.map((d) => ({ ...d, units: unitsByDay.find((u) => u.day === d.day)?.units ?? 0 })),
    current: { revenue: summary.bookedRevenue, sales: summary.sales, orders: liveOrders, units: items.ordered },
    previous,
  }
}

/** Totals of a period (cancelled orders excluded): net revenue, sales, orders, units ordered. */
async function periodTotals(db: DbOrTx, range: Range) {
  const inRange = and(gte(orders.createdAt, range.from), lt(orders.createdAt, range.to), sql`${orders.status} <> 'cancelled'`)
  const [[money], [items]] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(${NET}), 0)::int`,
        sales: sql<number>`coalesce(sum(${orders.subtotal} - ${orders.discountAmount}), 0)::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(inRange),
    db
      .select({ units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(inRange, isNull(orderItems.removedAt))),
  ])
  return { revenue: money.revenue, sales: money.sales, orders: money.orders, units: items.units }
}

/* ------------------------------------------------------------------ */
/* Abandoned carts                                                    */
/* ------------------------------------------------------------------ */

/**
 * A cart is abandoned when it still has items and nothing happened for
 * `hours`. Value uses current prices (estimate of potential revenue).
 */
export async function getAbandonedCarts(db: DbOrTx, opts: { hours: number; limit?: number; range?: Range }) {
  const cutoff = new Date(Date.now() - opts.hours * 60 * 60 * 1000)
  const conditions = [lt(carts.lastActivityAt, cutoff), sql`exists (select 1 from ${cartItems} where ${cartItems.cartId} = "carts"."id")`]
  if (opts.range) conditions.push(gte(carts.lastActivityAt, opts.range.from), lt(carts.lastActivityAt, opts.range.to))

  const rows = await db
    .select({
      id: carts.id,
      lastActivityAt: carts.lastActivityAt,
      checkoutStartedAt: carts.checkoutStartedAt,
      infoEnteredAt: carts.infoEnteredAt,
      orderId: carts.orderId,
      name: checkoutProfiles.fullName,
      phone: checkoutProfiles.phone,
      wilaya: checkoutProfiles.wilaya,
    })
    .from(carts)
    .leftJoin(checkoutProfiles, eq(checkoutProfiles.id, carts.profileId))
    .where(and(...conditions))
    .orderBy(desc(carts.lastActivityAt))
    .limit(opts.limit ?? 50)

  const ids = rows.map((r) => r.id)
  const lines = ids.length
    ? await db
        .select({
          cartId: cartItems.cartId,
          quantity: cartItems.quantity,
          size: productVariants.size,
          color: productVariants.color,
          name: products.name,
          price: products.price,
          salePrice: products.salePrice,
          priceOverride: productVariants.priceOverride,
          salePriceOverride: productVariants.salePriceOverride,
        })
        .from(cartItems)
        .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(cartItems.cartId, ids))
    : []

  const list = rows.map((r) => {
    const items = lines
      .filter((l) => l.cartId === r.id)
      .map((l) => ({ name: l.name, size: l.size, color: l.color, quantity: l.quantity, value: (unitPriceOf(l, l) ?? 0) * l.quantity }))
    return { ...r, items, value: items.reduce((s, i) => s + i.value, 0) }
  })

  const [totals] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(carts)
    .where(and(...conditions))
  const [value] = await db
    .select({
      total: sql<number>`coalesce(sum(coalesce(${effectivePriceSql('"product_variants"', '"products"')}, 0) * ${cartItems.quantity}), 0)::int`,
    })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(...conditions))

  return { carts: list, count: totals.count, estimatedValue: value.total }
}
