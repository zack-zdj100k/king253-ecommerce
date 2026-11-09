"use server"

import { z } from "zod"

import { db } from "@/server/db"
import { AppError, toUserMessage } from "@/server/errors"
import { cancelOrderByCustomer, findOrderByToken, findOrderForCustomer, type CustomerOrderView } from "@/server/orders/view"
import { rateLimit } from "@/server/rate-limit"
import { clientIp } from "@/server/request"
import { fieldErrors, phoneSchema, trackSchema } from "@/server/validation"

export type TrackResult =
  | { ok: true; order: CustomerOrderView; phone: string }
  | { ok: false; error: string; fields?: Record<string, string> }

export async function trackOrderAction(input: { number: string; phone: string }): Promise<TrackResult> {
  if (!rateLimit(`track:${await clientIp()}`, 20, 10 * 60_000).ok) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes." }
  }
  const parsed = trackSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Check the order number and phone.", fields: fieldErrors(parsed.error) }
  const order = await findOrderForCustomer(db, parsed.data.number, parsed.data.phone)
  if (!order) return { ok: false, error: "We couldn't find an order with this number and phone." }
  return { ok: true, order, phone: parsed.data.phone }
}

const cancelInput = z.object({
  number: z.string().trim().toUpperCase().max(40),
  token: z.string().max(200).optional(),
  phone: phoneSchema.optional(),
  reason: z.string().max(300).optional(),
})

export type CancelResult = { ok: true; order: CustomerOrderView } | { ok: false; error: string }

/** Customer cancels their order (secret link token or order number + phone). */
export async function cancelOrderAction(raw: z.input<typeof cancelInput>): Promise<CancelResult> {
  try {
    if (!rateLimit(`cancel:${await clientIp()}`, 10, 10 * 60_000).ok) return { ok: false, error: "Too many attempts. Please wait a few minutes." }
    const input = cancelInput.parse(raw)
    if (!input.token && !input.phone) return { ok: false, error: "We couldn't verify this order." }
    await cancelOrderByCustomer(db, input)
    const order = input.token ? await findOrderByToken(db, input.number, input.token) : await findOrderForCustomer(db, input.number, input.phone!)
    if (!order) throw new AppError("NOT_FOUND", "Order not found.")
    return { ok: true, order }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: "We couldn't verify this order." }
    return { ok: false, error: toUserMessage(error) }
  }
}
