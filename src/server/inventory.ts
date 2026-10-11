import { and, eq, sql } from "drizzle-orm"

import type { Tx } from "./db/client"
import { productVariants, stockMovements, stockReservations } from "./db/schema"
import { AppError, NotFoundError, OutOfStockError } from "./errors"

/*
 * Inventory model
 * ---------------
 *   available = physical - reserved          (derived, never stored)
 *
 *   order created    → reserved += qty        (reserve)
 *   order cancelled  → reserved -= qty        (release; physical untouched)
 *   order delivered  → physical -= qty, reserved -= qty   (consume)
 *   return received  → physical += qty when the item is resellable
 *
 * Every function here must run inside a transaction and writes a
 * stock_movements row with before/after values.
 */

type Ref = { refType: string; refId: string; actorUserId?: string | null; reason?: string | null }

type MovementType = (typeof stockMovements.$inferInsert)["type"]

async function logMovement(
  tx: Tx,
  variantId: string,
  type: MovementType,
  after: { physical: number; reserved: number },
  delta: { physical: number; reserved: number },
  ref: Ref
) {
  await tx.insert(stockMovements).values({
    variantId,
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

/**
 * Atomically reserve `quantity` units. The conditional UPDATE re-checks
 * availability on the locked row, so concurrent buyers can never oversell.
 */
export async function reserveStock(
  tx: Tx,
  input: { variantId: string; quantity: number; orderItemId?: string; returnRequestId?: string; label?: string } & Ref
) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new AppError("INVALID_QUANTITY", "Quantity must be at least 1.")
  }

  const [row] = await tx
    .update(productVariants)
    .set({ reserved: sql`${productVariants.reserved} + ${input.quantity}` })
    .where(
      and(
        eq(productVariants.id, input.variantId),
        eq(productVariants.active, true),
        sql`${productVariants.physical} - ${productVariants.reserved} >= ${input.quantity}`
      )
    )
    .returning({ physical: productVariants.physical, reserved: productVariants.reserved })

  if (!row) {
    const [current] = await tx
      .select({ physical: productVariants.physical, reserved: productVariants.reserved, active: productVariants.active })
      .from(productVariants)
      .where(eq(productVariants.id, input.variantId))
    if (!current) throw new NotFoundError("This product option")
    const available = current.active ? Math.max(0, current.physical - current.reserved) : 0
    throw new OutOfStockError(input.variantId, available, input.label)
  }

  const [reservation] = await tx
    .insert(stockReservations)
    .values({
      variantId: input.variantId,
      quantity: input.quantity,
      orderItemId: input.orderItemId ?? null,
      returnRequestId: input.returnRequestId ?? null,
    })
    .returning({ id: stockReservations.id })

  await logMovement(tx, input.variantId, "reserve", row, { physical: 0, reserved: input.quantity }, input)
  return reservation.id
}

/** Lock an active reservation so it can only be resolved once. */
async function lockActiveReservation(tx: Tx, reservationId: string) {
  const [reservation] = await tx
    .select()
    .from(stockReservations)
    .where(and(eq(stockReservations.id, reservationId), eq(stockReservations.status, "active")))
    .for("update")
  return reservation ?? null
}

/** Cancellation path: give the units back to "available". Physical stock is NOT touched. */
export async function releaseReservation(tx: Tx, reservationId: string, ref: Ref) {
  const reservation = await lockActiveReservation(tx, reservationId)
  if (!reservation) return false

  const [row] = await tx
    .update(productVariants)
    .set({ reserved: sql`${productVariants.reserved} - ${reservation.quantity}` })
    .where(eq(productVariants.id, reservation.variantId))
    .returning({ physical: productVariants.physical, reserved: productVariants.reserved })

  await tx
    .update(stockReservations)
    .set({ status: "released", resolvedAt: new Date() })
    .where(eq(stockReservations.id, reservationId))

  await logMovement(tx, reservation.variantId, "release", row, { physical: 0, reserved: -reservation.quantity }, ref)
  return true
}

/** Delivery path: the units physically leave — physical and reserved both decrease. */
export async function consumeReservation(tx: Tx, reservationId: string, ref: Ref & { type?: "deliver" | "exchange_ship" }) {
  const reservation = await lockActiveReservation(tx, reservationId)
  if (!reservation) return false

  const [row] = await tx
    .update(productVariants)
    .set({
      physical: sql`${productVariants.physical} - ${reservation.quantity}`,
      reserved: sql`${productVariants.reserved} - ${reservation.quantity}`,
    })
    .where(eq(productVariants.id, reservation.variantId))
    .returning({ physical: productVariants.physical, reserved: productVariants.reserved })

  await tx
    .update(stockReservations)
    .set({ status: "consumed", resolvedAt: new Date() })
    .where(eq(stockReservations.id, reservationId))

  await logMovement(
    tx,
    reservation.variantId,
    ref.type ?? "deliver",
    row,
    { physical: -reservation.quantity, reserved: -reservation.quantity },
    ref
  )
  return true
}

/** Active reservations for an order item (normally exactly one). */
export async function activeReservationsForItem(tx: Tx, orderItemId: string) {
  return tx
    .select({ id: stockReservations.id, quantity: stockReservations.quantity, variantId: stockReservations.variantId })
    .from(stockReservations)
    .where(and(eq(stockReservations.orderItemId, orderItemId), eq(stockReservations.status, "active")))
}

/**
 * Admin sets physical stock to a counted value. A reason is mandatory and
 * physical can never drop below what is already reserved for open orders.
 */
export async function adjustPhysicalStock(
  tx: Tx,
  input: { variantId: string; newPhysical: number; reason: string; actorUserId: string }
) {
  if (!Number.isInteger(input.newPhysical) || input.newPhysical < 0) {
    throw new AppError("INVALID_STOCK", "Physical stock must be a whole number of 0 or more.")
  }
  const reason = input.reason.trim()
  if (reason.length < 3) throw new AppError("REASON_REQUIRED", "Give a reason for this stock change.")

  const [current] = await tx
    .select({ physical: productVariants.physical, reserved: productVariants.reserved })
    .from(productVariants)
    .where(eq(productVariants.id, input.variantId))
    .for("update")
  if (!current) throw new NotFoundError("This variant")

  if (input.newPhysical < current.reserved) {
    throw new AppError(
      "BELOW_RESERVED",
      `${current.reserved} unit(s) are reserved by open orders. Physical stock cannot go below ${current.reserved}.`
    )
  }
  if (input.newPhysical === current.physical) return current

  const [row] = await tx
    .update(productVariants)
    .set({ physical: input.newPhysical })
    .where(eq(productVariants.id, input.variantId))
    .returning({ physical: productVariants.physical, reserved: productVariants.reserved })

  await logMovement(tx, input.variantId, "adjustment", row, { physical: input.newPhysical - current.physical, reserved: 0 }, {
    refType: "manual",
    refId: input.variantId,
    actorUserId: input.actorUserId,
    reason,
  })
  return row
}

/**
 * New delivery from the workshop/supplier: adds units on top of the current
 * physical stock in one atomic step (safe even if an order is delivered at
 * the same moment), recorded in the stock ledger.
 */
export async function receiveStock(tx: Tx, input: { variantId: string; quantity: number; note?: string | null; actorUserId: string }) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100_000) {
    throw new AppError("INVALID_QUANTITY", "Enter how many units arrived (1 or more).")
  }
  const [row] = await tx
    .update(productVariants)
    .set({ physical: sql`${productVariants.physical} + ${input.quantity}`, updatedAt: new Date() })
    .where(eq(productVariants.id, input.variantId))
    .returning({ physical: productVariants.physical, reserved: productVariants.reserved })
  if (!row) throw new NotFoundError("This variant")
  const note = input.note?.trim()
  await logMovement(tx, input.variantId, "adjustment", row, { physical: input.quantity, reserved: 0 }, {
    refType: "manual",
    refId: input.variantId,
    actorUserId: input.actorUserId,
    reason: `New stock received: +${input.quantity}${note ? ` — ${note.slice(0, 200)}` : ""}`,
  })
  return row
}

/** A returned item in resellable condition goes back on the shelf. */
export async function restockReturnedUnits(tx: Tx, input: { variantId: string; quantity: number } & Ref) {
  const [row] = await tx
    .update(productVariants)
    .set({ physical: sql`${productVariants.physical} + ${input.quantity}` })
    .where(eq(productVariants.id, input.variantId))
    .returning({ physical: productVariants.physical, reserved: productVariants.reserved })
  if (!row) throw new NotFoundError("This variant")
  await logMovement(tx, input.variantId, "return_restock", row, { physical: input.quantity, reserved: 0 }, input)
  return row
}

export function availableOf(variant: { physical: number; reserved: number; active?: boolean }) {
  if (variant.active === false) return 0
  return Math.max(0, variant.physical - variant.reserved)
}
