import { and, desc, eq, sql } from "drizzle-orm"

import type { DbOrTx } from "./db/client"
import { orderItems, orders, products, reviews } from "./db/schema"
import { AppError } from "./errors"

/**
 * New reviews start as "pending" and are only shown after admin approval.
 * "Verified purchase" is set ONLY when a delivered order with this phone
 * contains the product — never from anything the reviewer claims.
 */
export async function submitReview(
  db: DbOrTx,
  input: {
    productId: string
    authorName: string
    rating: number
    body: string
    userId?: string | null
    orderNumber?: string | null
    phone?: string | null
  }
) {
  const name = input.authorName.trim()
  const body = input.body.trim()
  if (name.length < 2 || name.length > 60) throw new AppError("INVALID_NAME", "Enter your name (2–60 characters).")
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new AppError("INVALID_RATING", "Choose 1 to 5 stars.")
  if (body.length < 10 || body.length > 2000) throw new AppError("INVALID_BODY", "Write at least 10 characters.")

  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.status, "published")))
  if (!product) throw new AppError("NOT_FOUND", "This product is not available for reviews.")

  let orderId: string | null = null
  if (input.orderNumber && input.phone) {
    const [match] = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.number, input.orderNumber.trim().toUpperCase()),
          eq(orders.customerPhone, input.phone),
          eq(orders.status, "delivered"),
          eq(orderItems.productId, product.id)
        )
      )
      .limit(1)
    orderId = match?.id ?? null
  }

  const [review] = await db
    .insert(reviews)
    .values({
      productId: product.id,
      authorName: name,
      rating: input.rating,
      body,
      status: "pending",
      verifiedPurchase: orderId !== null,
      orderId,
      userId: input.userId ?? null,
    })
    .returning({ id: reviews.id, verifiedPurchase: reviews.verifiedPurchase })
  return review
}

export async function approvedReviews(db: DbOrTx, productId: string, limit = 20) {
  return db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      body: reviews.body,
      verifiedPurchase: reviews.verifiedPurchase,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.verifiedPurchase), desc(reviews.createdAt))
    .limit(limit)
}

export async function reviewCounts(db: DbOrTx) {
  const [row] = await db
    .select({ pending: sql<number>`count(*) filter (where ${reviews.status} = 'pending')::int` })
    .from(reviews)
  return row
}
