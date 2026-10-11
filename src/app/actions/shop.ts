"use server"

import { and, eq, inArray } from "drizzle-orm"
import { after } from "next/server"
import { z } from "zod"

import { db } from "@/server/db"
import { wishlistItems, products } from "@/server/db/schema"
import { getCurrentUser } from "@/server/auth/session"
import { addToCart, ensureCart, getCartLines, removeFromCart, setCartQuantity, type CartLine } from "@/server/cart"
import { getCardsByIds, getCardsBySlugs, getProductPage, listProducts, productDetails, type ProductCardData } from "@/server/catalog"
import { getSettings } from "@/server/settings"
import { offerOf } from "@/server/pricing"
import { recordEvent } from "@/server/analytics"
import { toUserMessage } from "@/server/errors"
import { rateLimit } from "@/server/rate-limit"
import { clientIp, ensureSessionId, readCartId, writeCartId } from "@/server/request"

export type CartState = { lines: CartLine[]; count: number; subtotal: number; hasIssues: boolean }
export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string }

const EMPTY: CartState = { lines: [], count: 0, subtotal: 0, hasIssues: false }

async function stateOf(cartId: string | null): Promise<CartState> {
  if (!cartId) return EMPTY
  const lines = await getCartLines(db, cartId)
  return {
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0),
    hasIssues: lines.some((l) => l.issue !== null),
  }
}

export async function getCartAction(): Promise<CartState> {
  return stateOf(await readCartId())
}

const variantId = z.uuid()
const qty = z.number().int().min(0).max(20)

export async function addToCartAction(id: string, quantity = 1): Promise<ActionResult<CartState>> {
  try {
    if (!rateLimit(`cart:${await clientIp()}`, 60, 60_000).ok) return { ok: false, error: "Slow down a little and try again." }
    const v = variantId.parse(id)
    const q = qty.parse(quantity)
    const user = await getCurrentUser()
    const cartId = await ensureCart(db, await readCartId(), user?.id)
    await writeCartId(cartId)
    await addToCart(db, cartId, v, q || 1)
    const sid = await ensureSessionId()
    after(async () => {
      const line = (await getCartLines(db, cartId)).find((l) => l.variantId === v)
      await recordEvent(db, { type: "add_to_cart", sessionId: sid, productId: line?.productId, variantId: v, quantity: q || 1 })
    })
    return { ok: true, data: await stateOf(cartId) }
  } catch (error) {
    return { ok: false, error: toUserMessage(error) }
  }
}

export async function setCartQuantityAction(id: string, quantity: number): Promise<ActionResult<CartState>> {
  try {
    const cartId = await readCartId()
    if (!cartId) return { ok: true, data: EMPTY }
    await setCartQuantity(db, cartId, variantId.parse(id), qty.parse(quantity))
    return { ok: true, data: await stateOf(cartId) }
  } catch (error) {
    return { ok: false, error: toUserMessage(error) }
  }
}

export async function removeFromCartAction(id: string): Promise<ActionResult<CartState>> {
  try {
    const cartId = await readCartId()
    if (!cartId) return { ok: true, data: EMPTY }
    await removeFromCart(db, cartId, variantId.parse(id))
    return { ok: true, data: await stateOf(cartId) }
  } catch (error) {
    return { ok: false, error: toUserMessage(error) }
  }
}

/* ------------------------------------------------------------------ */
/* Product data for client components                                 */
/* ------------------------------------------------------------------ */

export type QuickViewData = {
  id: string
  slug: string
  name: string
  categoryName: string | null
  shortDescription: string | null
  /** Product price (promo price when on promo) and the regular price struck through. */
  price: number | null
  compareAt: number | null
  images: { url: string; focusX: number; focusY: number; zoom: number; alt: string | null; color: string | null }[]
  details: { title: string; body: string }[]
  /** Buying needs an account. */
  signedIn: boolean
  variants: { id: string; size: string; color: string; colorHex: string | null; price: number | null; compareAt: number | null; available: number }[]
}

export async function getQuickViewAction(slug: string): Promise<QuickViewData | null> {
  const page = await getProductPage(db, String(slug).slice(0, 200))
  if (!page) return null
  const { product, images, variants, category } = page
  const { brandName } = await getSettings(db)
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryName: category?.name ?? null,
    shortDescription: product.shortDescription,
    ...offerOf(product, { priceOverride: null }),
    images: images.map((i) => ({ url: i.url, focusX: i.focusX, focusY: i.focusY, zoom: i.zoom, alt: i.alt, color: i.color })),
    details: productDetails(product, brandName),
    signedIn: !!(await getCurrentUser()),
    variants,
  }
}

export async function searchAction(q: string): Promise<ProductCardData[]> {
  const query = String(q).trim().slice(0, 80)
  if (!query) return []
  if (!rateLimit(`search:${await clientIp()}`, 120, 60_000).ok) return []
  const { products } = await listProducts(db, { q: query, pageSize: 6 })
  return products
}

export async function getCardsByIdsAction(ids: string[]): Promise<ProductCardData[]> {
  return getCardsByIds(db, z.array(z.string()).max(50).parse(ids))
}

export async function getCardsBySlugsAction(slugs: string[]): Promise<ProductCardData[]> {
  return getCardsBySlugs(db, z.array(z.string().max(200)).max(50).parse(slugs))
}

/** Product view for analytics (de-duplicated per session/day in the database). */
export async function trackViewAction(productId: string) {
  const id = z.uuid().safeParse(productId)
  if (!id.success) return
  const sid = await ensureSessionId()
  after(() => recordEvent(db, { type: "product_view", sessionId: sid, productId: id.data }).catch(() => {}))
}

/* ------------------------------------------------------------------ */
/* Wishlist — localStorage for guests, database for signed-in users   */
/* ------------------------------------------------------------------ */

/** Returns the signed-in user's wishlist, merging any ids saved as a guest. Null for guests. */
export async function syncWishlistAction(localIds: string[]): Promise<string[] | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const ids = z.array(z.uuid()).max(100).catch([]).parse(localIds)
  if (ids.length) {
    const existing = await db.select({ id: products.id }).from(products).where(inArray(products.id, ids))
    if (existing.length) {
      await db
        .insert(wishlistItems)
        .values(existing.map((p) => ({ userId: user.id, productId: p.id })))
        .onConflictDoNothing()
    }
  }
  const rows = await db.select({ productId: wishlistItems.productId }).from(wishlistItems).where(eq(wishlistItems.userId, user.id))
  return rows.map((r) => r.productId)
}

export async function setWishlistItemAction(productId: string, saved: boolean) {
  const user = await getCurrentUser()
  if (!user) return
  const id = z.uuid().parse(productId)
  if (saved) await db.insert(wishlistItems).values({ userId: user.id, productId: id }).onConflictDoNothing()
  else await db.delete(wishlistItems).where(and(eq(wishlistItems.userId, user.id), eq(wishlistItems.productId, id)))
}
