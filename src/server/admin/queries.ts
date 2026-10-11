import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import {
  auditLogs,
  categories,
  customers,
  notifications,
  orderItems,
  orderStatusHistory,
  orders,
  productImages,
  productVariants,
  products,
  returnRequests,
  reviews,
  stockMovements,
  users,
} from "../db/schema"
import type { Range } from "../analytics"
import { netRevenueSql } from "../pricing"

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)
export const PAGE = 25

/* ------------------------------------------------------------------ */
/* Date ranges                                                        */
/* ------------------------------------------------------------------ */

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom"

/** Ranges follow the Algiers calendar day. */
export function resolveRange(key: string | undefined, from?: string, to?: string): { key: RangeKey; range: Range; label: string } {
  const now = new Date()
  const startOfDay = (d: Date) => {
    const local = new Date(d.toLocaleString("en-US", { timeZone: "Africa/Algiers" }))
    const offset = d.getTime() - local.getTime()
    local.setHours(0, 0, 0, 0)
    return new Date(local.getTime() + offset)
  }
  const tomorrow = new Date(startOfDay(now).getTime() + 86_400_000)
  if (key === "custom" && from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const f = startOfDay(new Date(`${from}T12:00:00Z`))
    const t = new Date(startOfDay(new Date(`${to}T12:00:00Z`)).getTime() + 86_400_000)
    if (f < t) return { key: "custom", range: { from: f, to: t }, label: `${from} → ${to}` }
  }
  const days = key === "today" ? 1 : key === "7d" ? 7 : key === "90d" ? 90 : 30
  const k: RangeKey = key === "today" || key === "7d" || key === "90d" ? key : "30d"
  return {
    key: k,
    range: { from: new Date(tomorrow.getTime() - days * 86_400_000), to: tomorrow },
    label: k === "today" ? "Today" : `Last ${days} days`,
  }
}

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */

export type OrderFilters = { q?: string; status?: string; sort?: string; page?: number; from?: Date; to?: Date }

export async function listOrders(db: DbOrTx, f: OrderFilters) {
  const where: SQL[] = []
  if (f.q) {
    const pat = `%${escapeLike(f.q.trim())}%`
    const digits = f.q.replace(/\D/g, "")
    const conds = [ilike(orders.number, pat), ilike(orders.customerName, pat)]
    if (digits.length >= 4) conds.push(ilike(orders.customerPhone, `%${digits.replace(/^0/, "")}%`))
    where.push(or(...conds)!)
  }
  if (f.status && f.status !== "all") where.push(sql`${orders.status} = ${f.status}`)
  if (f.from) where.push(gte(orders.createdAt, f.from))
  if (f.to) where.push(lt(orders.createdAt, f.to))
  const order =
    f.sort === "oldest" ? asc(orders.createdAt) : f.sort === "total_desc" ? desc(orders.total) : f.sort === "total_asc" ? asc(orders.total) : desc(orders.createdAt)
  const page = Math.max(1, f.page ?? 1)

  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      wilayaName: orders.wilayaName,
      total: orders.total,
      clothes: sql<number>`(${orders.subtotal} - ${orders.discountAmount})::int`,
      deliveryFee: orders.deliveryFee,
      freeDelivery: orders.freeDelivery,
      shipsWith: sql<string | null>`(select l.number from orders l where l.id = "orders"."ships_with_order_id")`,
      createdAt: orders.createdAt,
      items: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = "orders"."id" and oi.removed_at is null)`,
      count: sql<number>`count(*) over()::int`,
    })
    .from(orders)
    .where(where.length ? and(...where) : undefined)
    .orderBy(order)
    .limit(PAGE)
    .offset((page - 1) * PAGE)
  return { rows, total: rows[0]?.count ?? 0, page, pages: Math.max(1, Math.ceil((rows[0]?.count ?? 0) / PAGE)) }
}

export async function getOrderDetail(db: DbOrTx, id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id))
  if (!order) return null
  const [items, history, audit, mails, returns, customer] = await Promise.all([
    db
      .select({
        item: orderItems,
        productSlug: products.slug,
        variants: sql<{ id: string; size: string; color: string; available: number; active: boolean }[]>`(
          select coalesce(json_agg(json_build_object('id', v.id, 'size', v.size, 'color', v.color,
            'available', greatest(v.physical - v.reserved, 0), 'active', v.active) order by v.sort_order, v.color), '[]')
          from product_variants v where v.product_id = ${orderItems.productId})`,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.createdAt)),
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, id))
      .orderBy(asc(orderStatusHistory.createdAt)),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, data: auditLogs.data, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "order"), eq(auditLogs.entityId, id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
    db.select().from(notifications).where(eq(notifications.orderId, id)).orderBy(desc(notifications.createdAt)),
    db.select().from(returnRequests).where(eq(returnRequests.orderId, id)).orderBy(desc(returnRequests.createdAt)),
    order.customerId ? db.select().from(customers).where(eq(customers.id, order.customerId)).then((r) => r[0] ?? null) : null,
  ])
  const [{ customerOrders }] = order.customerId
    ? await db.select({ customerOrders: sql<number>`count(*)::int` }).from(orders).where(eq(orders.customerId, order.customerId))
    : [{ customerOrders: 0 }]
  // One delivery: the lead order this one ships with, or the orders shipping with this one.
  const [lead] = order.shipsWithOrderId
    ? await db.select({ id: orders.id, number: orders.number, status: orders.status }).from(orders).where(eq(orders.id, order.shipsWithOrderId))
    : []
  const followers = await db
    .select({ id: orders.id, number: orders.number, status: orders.status })
    .from(orders)
    .where(eq(orders.shipsWithOrderId, order.id))
    .orderBy(asc(orders.createdAt))
  return { order, items, history, audit, mails, returns, customer, customerOrders, shipping: { lead: lead ?? null, followers } }
}

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

export async function listCustomers(db: DbOrTx, f: { q?: string; page?: number; sort?: string }) {
  const where: SQL[] = []
  if (f.q) {
    const pat = `%${escapeLike(f.q.trim())}%`
    const digits = f.q.replace(/\D/g, "").replace(/^0/, "")
    where.push(or(ilike(customers.fullName, pat), ilike(customers.email, pat), ...(digits.length >= 4 ? [ilike(customers.phone, `%${digits}%`)] : []))!)
  }
  const page = Math.max(1, f.page ?? 1)
  const stats = sql`(select json_build_object(
      'orders', count(*), 'delivered', count(*) filter (where o.status = 'delivered'),
      'spent', coalesce(sum(${netRevenueSql("o")}) filter (where o.status = 'delivered'), 0), 'last', max(o.created_at))
    from orders o where o.customer_id = "customers"."id")`
  const rows = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      wilaya: customers.wilaya,
      createdAt: customers.createdAt,
      stats: sql<{ orders: number; delivered: number; spent: number; last: string | null }>`${stats}`,
      count: sql<number>`count(*) over()::int`,
    })
    .from(customers)
    .where(where.length ? and(...where) : undefined)
    .orderBy(f.sort === "name" ? asc(customers.fullName) : desc(customers.updatedAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE)
  return { rows, total: rows[0]?.count ?? 0, page, pages: Math.max(1, Math.ceil((rows[0]?.count ?? 0) / PAGE)) }
}

export async function getCustomerDetail(db: DbOrTx, id: string) {
  const [customer] = await db
    .select({ customer: customers, wilaya: customers.wilaya })
    .from(customers)
    .where(eq(customers.id, id))
  if (!customer) return null
  const list = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      revenue: sql<number>`${netRevenueSql('"orders"')}::int`,
      createdAt: orders.createdAt,
      items: sql<{ name: string; size: string; color: string; quantity: number }[]>`(
        select coalesce(json_agg(json_build_object('name', oi.product_name, 'size', oi.size, 'color', oi.color, 'quantity', oi.quantity)), '[]')
        from order_items oi where oi.order_id = "orders"."id" and oi.removed_at is null)`,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt))
  const delivered = list.filter((o) => o.status === "delivered")
  const spent = delivered.reduce((s, o) => s + o.revenue, 0)
  return {
    ...customer,
    orders: list,
    stats: {
      total: list.length,
      delivered: delivered.length,
      cancelled: list.filter((o) => o.status === "cancelled").length,
      open: list.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length,
      spent,
      average: delivered.length ? Math.round(spent / delivered.length) : 0,
      lastOrder: list[0]?.createdAt ?? null,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Products & inventory                                               */
/* ------------------------------------------------------------------ */

export async function listProductsAdmin(db: DbOrTx, f: { q?: string; status?: string; page?: number }) {
  const where: SQL[] = []
  if (f.q) where.push(or(ilike(products.name, `%${escapeLike(f.q)}%`), ilike(products.slug, `%${escapeLike(f.q)}%`))!)
  if (f.status && f.status !== "all") where.push(sql`${products.status} = ${f.status}`)
  const page = Math.max(1, f.page ?? 1)
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      status: products.status,
      price: products.price,
      salePrice: products.salePrice,
      featured: products.featured,
      category: categories.name,
      updatedAt: products.updatedAt,
      image: sql<{ url: string; focusX: number; focusY: number; zoom: number } | null>`(
        select json_build_object('url', i.url, 'focusX', i.focus_x, 'focusY', i.focus_y, 'zoom', i.zoom)
        from product_images i where i.product_id = "products"."id" order by i.is_main desc, i.sort_order limit 1)`,
      stock: sql<{ variants: number; physical: number; reserved: number }>`(
        select json_build_object('variants', count(*), 'physical', coalesce(sum(v.physical),0), 'reserved', coalesce(sum(v.reserved),0))
        from product_variants v where v.product_id = "products"."id" and v.active)`,
      count: sql<number>`count(*) over()::int`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(products.updatedAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE)
  return { rows, total: rows[0]?.count ?? 0, page, pages: Math.max(1, Math.ceil((rows[0]?.count ?? 0) / PAGE)) }
}

export async function getProductAdmin(db: DbOrTx, id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id))
  if (!product) return null
  const [images, variants, cats] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(desc(productImages.isMain), asc(productImages.sortOrder)),
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.sortOrder), asc(productVariants.color)),
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
  ])
  return { product, images, variants, categories: cats }
}

export async function listInventory(db: DbOrTx, f: { q?: string; filter?: string; threshold: number; page?: number }) {
  const where: SQL[] = [eq(productVariants.active, true)]
  if (f.q) {
    const pat = `%${escapeLike(f.q)}%`
    where.push(or(ilike(products.name, pat), ilike(productVariants.sku, pat), ilike(productVariants.barcode, pat))!)
  }
  const available = sql`(${productVariants.physical} - ${productVariants.reserved})`
  const threshold = sql`coalesce(${productVariants.lowStockThreshold}, ${f.threshold})`
  if (f.filter === "low") where.push(sql`${available} <= ${threshold} and ${available} > 0`)
  if (f.filter === "out") where.push(sql`${available} <= 0`)
  if (f.filter === "reserved") where.push(sql`${productVariants.reserved} > 0`)
  const page = Math.max(1, f.page ?? 1)
  const rows = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      size: productVariants.size,
      color: productVariants.color,
      physical: productVariants.physical,
      reserved: productVariants.reserved,
      threshold: sql<number>`${threshold}::int`,
      productId: products.id,
      productName: products.name,
      productStatus: products.status,
      count: sql<number>`count(*) over()::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(...where))
    .orderBy(sql`${available} asc`, asc(products.name))
    .limit(50)
    .offset((page - 1) * 50)
  return { rows, total: rows[0]?.count ?? 0, page, pages: Math.max(1, Math.ceil((rows[0]?.count ?? 0) / 50)) }
}

export async function lowStockVariants(db: DbOrTx, threshold: number, limit = 8) {
  const available = sql`(${productVariants.physical} - ${productVariants.reserved})`
  return db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      available: sql<number>`${available}::int`,
      productId: products.id,
      productName: products.name,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.active, true), eq(products.status, "published"), sql`${available} <= coalesce(${productVariants.lowStockThreshold}, ${threshold})`))
    .orderBy(sql`${available} asc`)
    .limit(limit)
}

export async function variantMovements(db: DbOrTx, variantId: string, limit = 50) {
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      physicalBefore: stockMovements.physicalBefore,
      physicalAfter: stockMovements.physicalAfter,
      reservedBefore: stockMovements.reservedBefore,
      reservedAfter: stockMovements.reservedAfter,
      reason: stockMovements.reason,
      refType: stockMovements.refType,
      refId: stockMovements.refId,
      actor: users.name,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.actorUserId))
    .where(eq(stockMovements.variantId, variantId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit)
}

/* ------------------------------------------------------------------ */
/* Reviews & returns                                                  */
/* ------------------------------------------------------------------ */

export async function listReviewsAdmin(db: DbOrTx, status: string) {
  return db
    .select({ review: reviews, productName: products.name, productSlug: products.slug })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(status === "all" ? undefined : sql`${reviews.status} = ${status}`)
    .orderBy(desc(reviews.createdAt))
    .limit(100)
}

export async function listReturnsAdmin(db: DbOrTx, status: string) {
  const replacement = sql<{ size: string; color: string; available: number } | null>`(
    select json_build_object('size', v.size, 'color', v.color, 'available', greatest(v.physical - v.reserved, 0))
    from product_variants v where v.id = ${returnRequests.replacementVariantId})`
  return db
    .select({
      request: returnRequests,
      orderNumber: orders.number,
      orderId: orders.id,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      item: { name: orderItems.productName, size: orderItems.size, color: orderItems.color, quantity: orderItems.quantity },
      replacement,
    })
    .from(returnRequests)
    .innerJoin(orders, eq(orders.id, returnRequests.orderId))
    .innerJoin(orderItems, eq(orderItems.id, returnRequests.orderItemId))
    .where(
      status === "open"
        ? inArray(returnRequests.status, ["requested", "approved", "received"])
        : status === "all"
          ? undefined
          : sql`${returnRequests.status} = ${status}`
    )
    .orderBy(desc(returnRequests.createdAt))
    .limit(100)
}

export async function recentOrders(db: DbOrTx, limit = 8) {
  return db
    .select({ id: orders.id, number: orders.number, status: orders.status, customerName: orders.customerName, total: orders.total, wilayaName: orders.wilayaName, createdAt: orders.createdAt })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
}

