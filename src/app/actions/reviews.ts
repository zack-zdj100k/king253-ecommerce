"use server"

import { z } from "zod"

import { normalizePhone } from "@/lib/phone"
import { db } from "@/server/db"
import { getCurrentUser } from "@/server/auth/session"
import { toUserMessage } from "@/server/errors"
import { rateLimit } from "@/server/rate-limit"
import { clientIp } from "@/server/request"
import { submitReview } from "@/server/reviews"

export type ReviewResult = { ok: true; verified: boolean } | { ok: false; error: string }

const input = z.object({
  productId: z.uuid(),
  authorName: z.string(),
  rating: z.coerce.number(),
  body: z.string(),
  orderNumber: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
})

export async function submitReviewAction(raw: unknown): Promise<ReviewResult> {
  try {
    if (!rateLimit(`review:${await clientIp()}`, 5, 60 * 60_000).ok) {
      return { ok: false, error: "You've sent several reviews recently. Please try again later." }
    }
    const data = input.parse(raw)
    const user = await getCurrentUser()
    const review = await submitReview(db, {
      ...data,
      rating: Math.round(data.rating),
      userId: user?.id ?? null,
      phone: data.phone ? normalizePhone(data.phone) : null,
    })
    return { ok: true, verified: review.verifiedPurchase }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: "Please complete the review." }
    return { ok: false, error: toUserMessage(error) }
  }
}
