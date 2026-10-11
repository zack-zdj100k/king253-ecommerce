"use server"

import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/server/db"
import { reviews, testimonials } from "@/server/db/schema"
import { audit } from "@/server/audit"
import { approveReturn, completeReturn, createReturnByAdmin, deleteReturn, markReturnReceived, rejectReturn } from "@/server/returns"
import { adminAction } from "./_shared"

const id = z.uuid()

/* Reviews --------------------------------------------------------- */

export async function moderateReviewAction(reviewId: string, status: "approved" | "rejected") {
  return adminAction(
    async ({ user, actor }) => {
      const s = z.enum(["approved", "rejected"]).parse(status)
      const [r] = await db
        .update(reviews)
        .set({ status: s, moderatedBy: user.id, moderatedAt: new Date() })
        .where(eq(reviews.id, id.parse(reviewId)))
        .returning({ productId: reviews.productId })
      if (r) await audit(db, actor, `review.${s}`, "review", reviewId, {})
    },
    { revalidate: ["/admin/reviews"], message: status === "approved" ? "Review published." : "Review hidden." }
  )
}

/** Removes inappropriate content permanently (reviews have no order/stock history). */
export async function deleteReviewAction(reviewId: string) {
  return adminAction(
    async ({ actor }) => {
      await db.delete(reviews).where(eq(reviews.id, id.parse(reviewId)))
      await audit(db, actor, "review.delete", "review", reviewId, {})
    },
    { revalidate: ["/admin/reviews"], message: "Review removed." }
  )
}

/* Testimonials ---------------------------------------------------- */

const testimonialInput = z.object({
  quote: z.string().trim().min(10, "Write the testimonial (10+ characters).").max(600),
  name: z.string().trim().min(2, "Enter the person's name.").max(60),
  role: z.string().trim().max(60).optional().transform((v) => v || null),
  imageUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^(\/(media|images)\/[\w/.-]+)?$/, "Use an uploaded image.")
    .optional()
    .transform((v) => v || null),
  published: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
})

export async function saveTestimonialAction(testimonialId: string | null, input: z.input<typeof testimonialInput>) {
  return adminAction(
    async ({ actor }) => {
      const data = testimonialInput.parse(input)
      if (testimonialId) await db.update(testimonials).set(data).where(eq(testimonials.id, id.parse(testimonialId)))
      else await db.insert(testimonials).values(data)
      await audit(db, actor, "testimonial.save", "testimonial", testimonialId ?? "new", { published: data.published })
    },
    { revalidate: ["/admin/testimonials", "/", "/who-is-king"], message: "Testimonial saved." }
  )
}

export async function deleteTestimonialAction(testimonialId: string) {
  return adminAction(
    async ({ actor }) => {
      await db.delete(testimonials).where(eq(testimonials.id, id.parse(testimonialId)))
      await audit(db, actor, "testimonial.delete", "testimonial", testimonialId, {})
    },
    { revalidate: ["/admin/testimonials", "/", "/who-is-king"], message: "Testimonial deleted." }
  )
}

/* Returns --------------------------------------------------------- */

export async function returnAction(
  requestId: string,
  step: "approve" | "reject" | "receive" | "complete",
  opts: { note?: string; condition?: "resellable" | "damaged" } = {}
) {
  return adminAction(
    async ({ actor }) => {
      const rid = id.parse(requestId)
      if (step === "approve") await approveReturn(db, { id: rid, actor, note: opts.note })
      else if (step === "reject") await rejectReturn(db, { id: rid, actor, note: opts.note })
      else if (step === "receive") await markReturnReceived(db, { id: rid, actor, condition: z.enum(["resellable", "damaged"]).parse(opts.condition) })
      else await completeReturn(db, { id: rid, actor })
    },
    { revalidate: ["/admin/returns", "/admin/inventory"], message: "Return updated." }
  )
}

export async function deleteReturnAction(requestId: string) {
  return adminAction(
    async ({ actor }) => {
      await deleteReturn(db, { id: id.parse(requestId), actor })
    },
    { revalidate: ["/admin/returns", "/admin/inventory"], message: "Request deleted." }
  )
}

const adminReturnInput = z.object({
  orderItemId: z.uuid(),
  type: z.enum(["return", "exchange"]),
  reason: z.string().trim().min(1, "Choose a reason.").max(120),
  details: z.string().max(1000).optional(),
  quantity: z.coerce.number().int().min(1, "Choose a quantity.").max(100),
  replacementVariantId: z.uuid().nullable().optional(),
  approve: z.boolean().default(true),
})

/** Shop records a return/exchange for a delivered order. */
export async function createReturnAction(orderId: string, raw: z.input<typeof adminReturnInput>) {
  return adminAction(
    async ({ actor }) => {
      const input = adminReturnInput.parse(raw)
      await createReturnByAdmin(db, { ...input, orderId: id.parse(orderId), actor })
    },
    { revalidate: [`/admin/orders/${orderId}`, "/admin/returns", "/admin/inventory"], message: "Return recorded — follow it up below or in Returns." }
  )
}
