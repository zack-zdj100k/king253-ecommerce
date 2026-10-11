import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { cartItems, carts, checkoutProfiles, productImages, productVariants, products } from "./db/schema"
import { AppError } from "./errors"
import { availableOf } from "./inventory"
import { unitPriceOf } from "./pricing"

/*
 * The bag is shopping intent only — adding items NEVER reserves stock.
 * Availability is re-checked on every read and again (atomically) at checkout.
 */

export const MAX_LINE_QTY = 20

function lineSelect(db: DbOrTx) {
  return db
    .select({
      variantId: productVariants.id,
      size: productVariants.size,
      color: productVariants.color,
      colorHex: productVariants.colorHex,
      sku: productVariants.sku,
      physical: productVariants.physical,
      reserved: productVariants.reserved,
      variantActive: productVariants.active,
      priceOverride: productVariants.priceOverride,
      salePriceOverride: productVariants.salePriceOverride,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      status: products.status,
      price: products.price,
      salePrice: products.salePrice,
      image: sql<{ url: string; focusX: number; focusY: number; zoom: number } | null>`(
        select json_build_object('url', ${productImages.url}, 'focusX', ${productImages.focusX}, 'focusY', ${productImages.focusY}, 'zoom', ${productImages.zoom})
        from ${productImages} where ${productImages.productId} = "products"."id"
        order by case when ${productImages.color} = "product_variants"."color" then 0 when ${productImages.color} is null then 1 else 2 end,
          ${productImages.isMain} desc, ${productImages.sortOrder} asc limit 1)`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
}

type LineRow = Awaited<ReturnType<ReturnType<typeof lineSelect>["execute"]>>[number]

function toLine(r: LineRow, quantity: number) {
  const purchasable = r.variantActive && r.status === "published"
  const available = purchasable ? availableOf({ physical: r.physical, reserved: r.reserved }) : 0
  const unitPrice = unitPriceOf(r, r)
  return {
    variantId: r.variantId,
    productId: r.productId,
    slug: r.slug,
    name: r.name,
    size: r.size,
    color: r.color,
    colorHex: r.colorHex,
    sku: r.sku,
    quantity,
    unitPrice,
    lineTotal: unitPrice === null ? null : unitPrice * quantity,
    available,
    /** Problems the customer must fix before checkout. */
    issue:
      !purchasable || unitPrice === null
        ? ("unavailable" as const)
        : available === 0
          ? ("out_of_stock" as const)
          : quantity > available
            ? ("not_enough" as const)
            : null,
    image: r.image,
  }
}

export async function getCartLines(db: DbOrTx, cartId: string) {
  const rows = await db
    .select({ variantId: cartItems.variantId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.addedAt))
  if (!rows.length) return []
  const details = await lineSelect(db).where(inArray(productVariants.id, rows.map((r) => r.variantId)))
  return rows.flatMap((r) => {
    const d = details.find((x) => x.variantId === r.variantId)
    return d ? [toLine(d, r.quantity)] : []
  })
}

/** Single line for Buy Now, computed exactly like a bag line. */
export async function getVariantLine(db: DbOrTx, variantId: string, quantity: number) {
  const [row] = await lineSelect(db).where(eq(productVariants.id, variantId))
  return row ? toLine(row, quantity) : null
}
export type CartLine = Awaited<ReturnType<typeof getCartLines>>[number]

export async function ensureCart(db: DbOrTx, cartId: string | null, userId?: string | null) {
  if (cartId) {
    const [existing] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, cartId))
    if (existing) return existing.id
  }
  const [created] = await db.insert(carts).values({ userId: userId ?? null }).returning({ id: carts.id })
  return created.id
}

/** Purchasable variant with stock check; the bag can never hold more than what's available. */
async function loadPurchasable(db: DbOrTx, variantId: string) {
  const [row] = await db
    .select({
      physical: productVariants.physical,
      reserved: productVariants.reserved,
      active: productVariants.active,
      status: products.status,
      price: products.price,
      salePrice: products.salePrice,
      priceOverride: productVariants.priceOverride,
      salePriceOverride: productVariants.salePriceOverride,
      name: products.name,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId))
  if (!row || !row.active || row.status !== "published" || unitPriceOf(row, row) === null) {
    throw new AppError("UNAVAILABLE", "This item is no longer available.")
  }
  return { ...row, available: availableOf(row) }
}

async function touch(db: DbOrTx, cartId: string) {
  await db.update(carts).set({ lastActivityAt: new Date() }).where(eq(carts.id, cartId))
}

export async function addToCart(db: DbOrTx, cartId: string, variantId: string, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError("INVALID_QUANTITY", "Choose a quantity.")
  const v = await loadPurchasable(db, variantId)
  if (v.available === 0) throw new AppError("OUT_OF_STOCK", "This size is out of stock.")

  const [current] = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
  const wanted = Math.min((current?.quantity ?? 0) + quantity, MAX_LINE_QTY)
  if (wanted > v.available) {
    throw new AppError("NOT_ENOUGH", `Only ${v.available} left in this size.`)
  }
  // A converted cart that is empty again starts a fresh shopping session.
  const [cart] = await db.select({ orderId: carts.orderId }).from(carts).where(eq(carts.id, cartId))
  if (cart?.orderId) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cartItems)
      .where(eq(cartItems.cartId, cartId))
    if (count === 0) {
      await db.update(carts).set({ orderId: null, checkoutStartedAt: null, infoEnteredAt: null }).where(eq(carts.id, cartId))
    }
  }
  await db
    .insert(cartItems)
    .values({ cartId, variantId, quantity: wanted })
    .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: wanted } })
  await touch(db, cartId)
}

export async function setCartQuantity(db: DbOrTx, cartId: string, variantId: string, quantity: number) {
  if (quantity <= 0) return removeFromCart(db, cartId, variantId)
  const v = await loadPurchasable(db, variantId)
  const capped = Math.min(quantity, MAX_LINE_QTY)
  if (capped > v.available) throw new AppError("NOT_ENOUGH", v.available ? `Only ${v.available} left in this size.` : "This size is out of stock.")
  await db
    .update(cartItems)
    .set({ quantity: capped })
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
  await touch(db, cartId)
}

export async function removeFromCart(db: DbOrTx, cartId: string, variantId: string) {
  await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
  await touch(db, cartId)
}

export async function markCheckoutStarted(db: DbOrTx, cartId: string) {
  await db
    .update(carts)
    .set({ checkoutStartedAt: sql`coalesce(${carts.checkoutStartedAt}, now())`, lastActivityAt: new Date() })
    .where(and(eq(carts.id, cartId), isNull(carts.orderId)))
}

export async function markInfoEntered(db: DbOrTx, cartId: string, profileId: string) {
  await db
    .update(carts)
    .set({ infoEnteredAt: sql`coalesce(${carts.infoEnteredAt}, now())`, profileId, lastActivityAt: new Date() })
    .where(eq(carts.id, cartId))
}

/* ------------------------------------------------------------------ */
/* Saved checkout details (server-side, keyed by hashed cookie token)  */
/* ------------------------------------------------------------------ */

const PROFILE_DAYS = 30

export type CheckoutDraft = {
  fullName?: string | null
  age?: number | null
  phone?: string | null
  email?: string | null
  wilaya?: string | null
  city?: string | null
  address?: string | null
  notes?: string | null
}

export async function getCheckoutProfile(db: DbOrTx, profileId: string) {
  const [row] = await db
    .select()
    .from(checkoutProfiles)
    .where(and(eq(checkoutProfiles.id, profileId), sql`${checkoutProfiles.expiresAt} > now()`))
  return row ?? null
}

export async function saveCheckoutProfile(db: DbOrTx, profileId: string, draft: CheckoutDraft) {
  const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== undefined))
  const expiresAt = new Date(Date.now() + PROFILE_DAYS * 24 * 60 * 60 * 1000)
  await db
    .insert(checkoutProfiles)
    .values({ id: profileId, ...clean, expiresAt })
    .onConflictDoUpdate({ target: checkoutProfiles.id, set: { ...clean, expiresAt, updatedAt: new Date() } })
}

/** Admin: remove an abandoned bag (items go with it; no stock was ever reserved for a bag). */
export async function deleteCart(db: DbOrTx, cartId: string) {
  const [removed] = await db.delete(carts).where(eq(carts.id, cartId)).returning({ id: carts.id })
  return removed ?? null
}
