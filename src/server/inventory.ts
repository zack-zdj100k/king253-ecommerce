import { and, asc, eq, inArray, sql } from "drizzle-orm"

import type { DbOrTx, Tx } from "./db/client"
import { productStores, productVariants, stockMovements, stockReservations, storeStock, stores } from "./db/schema"
import { AppError, NotFoundError, OutOfStockError } from "./errors"

/*
 * Inventory model
 * ---------------
 * Stock lives per variant (size + colour) PER SHOP in store_stock.
 * product_variants.physical / reserved are the totals over all shops and are
 * updated in the same transaction, so catalogue queries stay simple.
 *
 *   available (shop) = physical - reserved     (derived, never stored)
 *
 *   order created    → reserved += qty        (reserve, in the departure shop)
 *   order cancelled  → reserved -= qty        (release; physical untouched)
 *   order delivered  → physical -= qty, reserved -= qty   (consume)
 *   return / exchange back → physical += qty  (restock, in the chosen shop)
 *
 * Every function here must run inside a transaction and writes a
 * stock_movements row with the shop's before/after values.
 */

type Ref = { refType: string; refId: string; actorUserId?: string | null; reason?: string | null }

type MovementType = (typeof stockMovements.$inferInsert)["type"]
type Level = { physical: number; reserved: number }

async function logMovement(tx: Tx, variantId: string, storeId: number, type: MovementType, after: Level, delta: Level, ref: Ref) {
  await tx.insert(stockMovements).values({
    variantId,
    storeId,
    type,
    physicalAfter: after.physical,
    reservedAfter: after.reserved,
    physicalBefore: after.physical - delta.physical,
    reservedBefore: after.reserved - delta.reserved,
    reason: ref.reason ?? null,
    refType: ref.refType,
    refId: ref.refId,
    actorUserId: ref.actorUserId ?? null,
  })
}

/** Keep the variant's all-shop totals in step with a shop change. */
async function bumpTotals(tx: Tx, variantId: string, delta: Level) {
  await tx
    .update(productVariants)
    .set({
      physical: sql`${productVariants.physical} + ${delta.physical}`,
      reserved: sql`${productVariants.reserved} + ${delta.reserved}`,
    })
    .where(eq(productVariants.id, variantId))
}

/** Stock row of a variant in a shop, created at 0 when the shop doesn't carry it yet. Locked for update. */
async function lockShopStock(tx: Tx, variantId: string, storeId: number): Promise<Level> {
  await tx.insert(storeStock).values({ variantId, storeId }).onConflictDoNothing()
  const [row] = await tx
    .select({ physical: storeStock.physical, reserved: storeStock.reserved })
    .from(storeStock)
    .where(and(eq(storeStock.variantId, variantId), eq(storeStock.storeId, storeId)))
    .for("update")
  return row
}

/** Apply a delta to a shop row + the totals, log it, return the shop's new level. */
async function applyDelta(tx: Tx, variantId: string, storeId: number, type: MovementType, delta: Level, ref: Ref) {
  const [row] = await tx
    .update(storeStock)
    .set({
      physical: sql`${storeStock.physical} + ${delta.physical}`,
      reserved: sql`${storeStock.reserved} + ${delta.reserved}`,
      updatedAt: new Date(),
    })
    .where(and(eq(storeStock.variantId, variantId), eq(storeStock.storeId, storeId)))
    .returning({ physical: storeStock.physical, reserved: storeStock.reserved })
  if (!row) throw new NotFoundError("This shop's stock")
  await bumpTotals(tx, variantId, delta)
  await logMovement(tx, variantId, storeId, type, row, delta, ref)
  return row
}

/**
 * Atomically reserve `quantity` units in one shop. The conditional UPDATE
 * re-checks availability on the locked row, so concurrent buyers can never oversell.
 */
export async function reserveStock(
  tx: Tx,
  input: { variantId: string; storeId: number; quantity: number; orderItemId?: string; returnRequestId?: string; label?: string } & Ref
) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new AppError("INVALID_QUANTITY", "Quantity must be at least 1.")
  }

  const [row] = await tx
    .update(storeStock)
    .set({ reserved: sql`${storeStock.reserved} + ${input.quantity}`, updatedAt: new Date() })
    .where(
      and(
        eq(storeStock.variantId, input.variantId),
        eq(storeStock.storeId, input.storeId),
        sql`${storeStock.physical} - ${storeStock.reserved} >= ${input.quantity}`,
        sql`exists (select 1 from ${productVariants} where ${productVariants.id} = ${input.variantId} and ${productVariants.active})`,
        sql`exists (select 1 from ${stores} where ${stores.id} = ${input.storeId} and ${stores.active})`
      )
    )
    .returning({ physical: storeStock.physical, reserved: storeStock.reserved })

  if (!row) {
    const [variant] = await tx.select({ active: productVariants.active }).from(productVariants).where(eq(productVariants.id, input.variantId))
    if (!variant) throw new NotFoundError("This product option")
    const [current] = await tx
      .select({ physical: storeStock.physical, reserved: storeStock.reserved, shopActive: stores.active })
      .from(storeStock)
      .innerJoin(stores, eq(stores.id, storeStock.storeId))
      .where(and(eq(storeStock.variantId, input.variantId), eq(storeStock.storeId, input.storeId)))
    const available = variant.active && current?.shopActive ? Math.max(0, current.physical - current.reserved) : 0
    throw new OutOfStockError(input.variantId, available, input.label)
  }

  const delta = { physical: 0, reserved: input.quantity }
  await bumpTotals(tx, input.variantId, delta)

  const [reservation] = await tx
    .insert(stockReservations)
    .values({
      variantId: input.variantId,
      storeId: input.storeId,
      quantity: input.quantity,
      orderItemId: input.orderItemId ?? null,
      returnRequestId: input.returnRequestId ?? null,
    })
    .returning({ id: stockReservations.id })

  await logMovement(tx, input.variantId, input.storeId, "reserve", row, delta, input)
  return reservation.id
}

/** Lock an active reservation so it can only be resolved once. */
async function lockActiveReservation(tx: Tx, reservationId: string) {
  const [reservation] = await tx
    .select()
    .from(stockReservations)
    .where(and(eq(stockReservations.id, reservationId), eq(stockReservations.status, "active")))
    .for("update")
  if (reservation && reservation.storeId === null) throw new AppError("NO_SHOP", "This reservation has no shop.")
  return reservation ?? null
}

/** Cancellation path: give the units back to "available". Physical stock is NOT touched. */
export async function releaseReservation(tx: Tx, reservationId: string, ref: Ref) {
  const reservation = await lockActiveReservation(tx, reservationId)
  if (!reservation) return false
  await applyDelta(tx, reservation.variantId, reservation.storeId!, "release", { physical: 0, reserved: -reservation.quantity }, ref)
  await tx.update(stockReservations).set({ status: "released", resolvedAt: new Date() }).where(eq(stockReservations.id, reservationId))
  return true
}

/** Delivery path: the units physically leave the shop — physical and reserved both decrease. */
export async function consumeReservation(tx: Tx, reservationId: string, ref: Ref & { type?: "deliver" | "exchange_ship" }) {
  const reservation = await lockActiveReservation(tx, reservationId)
  if (!reservation) return false
  await applyDelta(
    tx,
    reservation.variantId,
    reservation.storeId!,
    ref.type ?? "deliver",
    { physical: -reservation.quantity, reserved: -reservation.quantity },
    ref
  )
  await tx.update(stockReservations).set({ status: "consumed", resolvedAt: new Date() }).where(eq(stockReservations.id, reservationId))
  return true
}

/** Active reservations for an order item (normally exactly one). */
export async function activeReservationsForItem(tx: Tx, orderItemId: string) {
  return tx
    .select({ id: stockReservations.id, quantity: stockReservations.quantity, variantId: stockReservations.variantId, storeId: stockReservations.storeId })
    .from(stockReservations)
    .where(and(eq(stockReservations.orderItemId, orderItemId), eq(stockReservations.status, "active")))
}

/** Selling a product in a shop requires it to be one of the product's shops. */
async function ensureProductInShop(tx: Tx, variantId: string, storeId: number) {
  const [variant] = await tx.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, variantId))
  if (!variant) throw new NotFoundError("This variant")
  const [shop] = await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, storeId))
  if (!shop) throw new NotFoundError("This shop")
  await tx.insert(productStores).values({ productId: variant.productId, storeId }).onConflictDoNothing()
}

/**
 * Admin sets a shop's physical stock to a counted value. A reason is mandatory
 * and physical can never drop below what is already reserved for open orders.
 */
export async function adjustPhysicalStock(
  tx: Tx,
  input: { variantId: string; storeId: number; newPhysical: number; reason: string; actorUserId: string }
) {
  if (!Number.isInteger(input.newPhysical) || input.newPhysical < 0) {
    throw new AppError("INVALID_STOCK", "Physical stock must be a whole number of 0 or more.")
  }
  const reason = input.reason.trim()
  if (reason.length < 3) throw new AppError("REASON_REQUIRED", "Give a reason for this stock change.")

  await ensureProductInShop(tx, input.variantId, input.storeId)
  const current = await lockShopStock(tx, input.variantId, input.storeId)

  if (input.newPhysical < current.reserved) {
    throw new AppError(
      "BELOW_RESERVED",
      `${current.reserved} unit(s) are reserved by open orders in this shop. Physical stock cannot go below ${current.reserved}.`
    )
  }
  if (input.newPhysical === current.physical) return current

  return applyDelta(tx, input.variantId, input.storeId, "adjustment", { physical: input.newPhysical - current.physical, reserved: 0 }, {
    refType: "manual",
    refId: input.variantId,
    actorUserId: input.actorUserId,
    reason,
  })
}

/**
 * New delivery from the workshop/supplier to one shop: adds units on top of
 * its physical stock in one atomic step, recorded in the stock ledger.
 */
export async function receiveStock(tx: Tx, input: { variantId: string; storeId: number; quantity: number; note?: string | null; actorUserId: string }) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100_000) {
    throw new AppError("INVALID_QUANTITY", "Enter how many units arrived (1 or more).")
  }
  await ensureProductInShop(tx, input.variantId, input.storeId)
  await lockShopStock(tx, input.variantId, input.storeId)
  const note = input.note?.trim()
  return applyDelta(tx, input.variantId, input.storeId, "adjustment", { physical: input.quantity, reserved: 0 }, {
    refType: "manual",
    refId: input.variantId,
    actorUserId: input.actorUserId,
    reason: `New stock received: +${input.quantity}${note ? ` — ${note.slice(0, 200)}` : ""}`,
  })
}

/** A returned/exchanged item goes back on the shelf of a shop. */
export async function restockReturnedUnits(tx: Tx, input: { variantId: string; storeId: number; quantity: number } & Ref) {
  await lockShopStock(tx, input.variantId, input.storeId)
  return applyDelta(tx, input.variantId, input.storeId, "return_restock", { physical: input.quantity, reserved: 0 }, input)
}

/**
 * Exchange: units handed straight to the customer from a shop's shelf
 * (no reservation step). Refused when the shop doesn't have them available.
 */
export async function handOverUnits(tx: Tx, input: { variantId: string; storeId: number; quantity: number; label?: string } & Ref) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new AppError("INVALID_QUANTITY", "Quantity must be at least 1.")
  const [row] = await tx
    .update(storeStock)
    .set({ physical: sql`${storeStock.physical} - ${input.quantity}`, updatedAt: new Date() })
    .where(
      and(
        eq(storeStock.variantId, input.variantId),
        eq(storeStock.storeId, input.storeId),
        sql`${storeStock.physical} - ${storeStock.reserved} >= ${input.quantity}`
      )
    )
    .returning({ physical: storeStock.physical, reserved: storeStock.reserved })
  if (!row) {
    const [cur] = await tx
      .select({ physical: storeStock.physical, reserved: storeStock.reserved })
      .from(storeStock)
      .where(and(eq(storeStock.variantId, input.variantId), eq(storeStock.storeId, input.storeId)))
    throw new OutOfStockError(input.variantId, cur ? Math.max(0, cur.physical - cur.reserved) : 0, input.label)
  }
  const delta = { physical: -input.quantity, reserved: 0 }
  await bumpTotals(tx, input.variantId, delta)
  await logMovement(tx, input.variantId, input.storeId, "exchange_ship", row, delta, input)
  return row
}

/**
 * Shops a product is sold in. Adding a shop creates 0-stock rows for every
 * variant; removing one is refused while that shop still has units of it.
 */
export async function setProductStores(tx: Tx, productId: string, storeIds: number[]) {
  const wanted = [...new Set(storeIds)]
  const current = await tx.select({ storeId: productStores.storeId }).from(productStores).where(eq(productStores.productId, productId))
  const removed = current.map((c) => c.storeId).filter((id) => !wanted.includes(id))
  const variants = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, productId))

  for (const storeId of removed) {
    const [left] = await tx
      .select({ physical: sql<number>`coalesce(sum(${storeStock.physical}), 0)::int`, name: sql<string>`max(${stores.name})` })
      .from(storeStock)
      .innerJoin(productVariants, eq(productVariants.id, storeStock.variantId))
      .innerJoin(stores, eq(stores.id, storeStock.storeId))
      .where(and(eq(productVariants.productId, productId), eq(storeStock.storeId, storeId)))
    if (left && left.physical > 0) {
      throw new AppError("SHOP_HAS_STOCK", `${left.name} still has ${left.physical} unit(s) of this product. Set its stock to 0 first.`)
    }
    await tx.delete(productStores).where(and(eq(productStores.productId, productId), eq(productStores.storeId, storeId)))
    for (const v of variants) {
      await tx.delete(storeStock).where(and(eq(storeStock.variantId, v.id), eq(storeStock.storeId, storeId)))
    }
  }
  for (const storeId of wanted) {
    await tx.insert(productStores).values({ productId, storeId }).onConflictDoNothing()
    for (const v of variants) await tx.insert(storeStock).values({ variantId: v.id, storeId }).onConflictDoNothing()
  }
}

/** A new variant gets a 0-stock row in every shop of its product. */
export async function addVariantToProductShops(tx: Tx, productId: string, variantId: string) {
  const shops = await tx.select({ storeId: productStores.storeId }).from(productStores).where(eq(productStores.productId, productId))
  for (const s of shops) await tx.insert(storeStock).values({ variantId, storeId: s.storeId }).onConflictDoNothing()
}

/**
 * Active shops that can ship the WHOLE list (every variant, every quantity),
 * in the shops' display order. Orders are never split between shops.
 */
export async function shopsThatCanFulfil(db: DbOrTx, lines: { variantId: string; quantity: number }[]) {
  const need = new Map<string, number>()
  for (const l of lines) need.set(l.variantId, (need.get(l.variantId) ?? 0) + l.quantity)
  if (!need.size) return []
  const rows = await db
    .select({ storeId: storeStock.storeId, variantId: storeStock.variantId, available: sql<number>`(${storeStock.physical} - ${storeStock.reserved})::int` })
    .from(storeStock)
    .innerJoin(stores, eq(stores.id, storeStock.storeId))
    .where(and(inArray(storeStock.variantId, [...need.keys()]), eq(stores.active, true)))
  const shops = await db.select().from(stores).where(eq(stores.active, true)).orderBy(asc(stores.sortOrder), asc(stores.name))
  return shops.filter((shop) =>
    [...need.entries()].every(([variantId, qty]) => (rows.find((r) => r.storeId === shop.id && r.variantId === variantId)?.available ?? 0) >= qty)
  )
}

/** Available units per shop for some variants (active shops only): variantId → storeId → units. */
export async function shopAvailability(db: DbOrTx, variantIds: string[]) {
  const out = new Map<string, Map<number, number>>()
  if (!variantIds.length) return out
  const rows = await db
    .select({ storeId: storeStock.storeId, variantId: storeStock.variantId, available: sql<number>`greatest(${storeStock.physical} - ${storeStock.reserved}, 0)::int` })
    .from(storeStock)
    .innerJoin(stores, eq(stores.id, storeStock.storeId))
    .where(and(inArray(storeStock.variantId, variantIds), eq(stores.active, true)))
  for (const r of rows) {
    if (!out.has(r.variantId)) out.set(r.variantId, new Map())
    out.get(r.variantId)!.set(r.storeId, r.available)
  }
  return out
}

/**
 * What the storefront may sell of a variant: the best single ACTIVE shop's
 * available units (an order ships from one shop, so units are never added
 * across shops). Raw SQL version for queries that alias variants as `v`.
 */
export const SELLABLE_V = sql.raw(`(select coalesce(max(greatest(ss.physical - ss.reserved, 0)), 0)
  from store_stock ss join stores s on s.id = ss.store_id and s.active where ss.variant_id = v.id)`)

/**
 * Drop-in for `{ physical, reserved }` in storefront selects on product_variants:
 * physical = sellable units (see SELLABLE_V), reserved = 0.
 */
export function storefrontStock() {
  return {
    physical: sql<number>`(select coalesce(max(greatest(ss.physical - ss.reserved, 0)), 0)
      from store_stock ss join stores s on s.id = ss.store_id and s.active where ss.variant_id = "product_variants"."id")::int`,
    reserved: sql<number>`0`,
  }
}

export function availableOf(variant: { physical: number; reserved: number; active?: boolean }) {
  if (variant.active === false) return 0
  return Math.max(0, variant.physical - variant.reserved)
}
