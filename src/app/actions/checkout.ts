"use server"

import { after } from "next/server"
import { z } from "zod"

import { formatClosureDate, shopClosure } from "@/lib/closure"
import { normalizePhone } from "@/lib/phone"
import { db } from "@/server/db"
import { getCurrentUser } from "@/server/auth/session"
import { getCartLines, markInfoEntered, saveCheckoutProfile } from "@/server/cart"
import { sendNewOrderEmails } from "@/server/email/send"
import { AppError, OutOfStockError, toUserMessage } from "@/server/errors"
import { createOrder, ValidationError } from "@/server/orders/create"
import { rateLimit } from "@/server/rate-limit"
import { getSettings } from "@/server/settings"
import { clientIp, ensureProfileId, readCartId, readSessionId } from "@/server/request"

export type PlaceOrderResult =
  | { ok: true; number: string; token: string }
  | { ok: false; error: string; fields?: Record<string, string>; stock?: boolean }

const placeOrderInput = z.object({
  mode: z.enum(["buy_now", "cart"]),
  buyNow: z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(20) }).optional(),
  idempotencyKey: z.string().min(16).max(100),
  customer: z.record(z.string(), z.unknown()),
})

/**
 * One checkout, one order. Buy Now sends a single line; Buy All uses the
 * server-side bag (never trusting lines or prices from the browser).
 */
export async function placeOrderAction(raw: unknown): Promise<PlaceOrderResult> {
  try {
    if (!rateLimit(`order:${await clientIp()}`, 8, 10 * 60_000).ok) {
      return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." }
    }
    const closure = shopClosure(await getSettings(db))
    if (closure.state === "closed") {
      return { ok: false, error: closure.until ? `The shop is closed until ${formatClosureDate(closure.until)} — orders are paused.` : "The shop is closed for now — orders are paused." }
    }
    const input = placeOrderInput.parse(raw)
    const user = await getCurrentUser()
    if (!user) return { ok: false, error: "Please create an account or sign in to place your order. Your bag is saved." }

    let lines: { variantId: string; quantity: number }[]
    const cartId = input.mode === "cart" ? await readCartId() : null
    if (input.mode === "cart") {
      if (!cartId) return { ok: false, error: "Your bag is empty." }
      const cart = await getCartLines(db, cartId)
      const blocked = cart.find((l) => l.issue)
      if (blocked) {
        return {
          ok: false,
          stock: true,
          error:
            blocked.issue === "not_enough"
              ? `Only ${blocked.available} left of ${blocked.name} (${blocked.size}). Update your bag.`
              : `Sorry, ${blocked.name} (${blocked.color} / ${blocked.size}) is no longer available.`,
        }
      }
      lines = cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
    } else {
      if (!input.buyNow) return { ok: false, error: "Choose a size first." }
      lines = [input.buyNow]
    }

    const order = await createOrder(
      db,
      { customer: input.customer as never, lines, idempotencyKey: input.idempotencyKey },
      { userId: user?.id ?? null, cartId, sessionId: await readSessionId() }
    )

    // Remember details for the next Buy Now (server-side, keyed by a hashed cookie).
    const profileId = await ensureProfileId()
    await saveCheckoutProfile(db, profileId, {
      fullName: order.customerName,
      age: order.customerAge,
      phone: order.customerPhone,
      email: order.customerEmail,
      wilaya: order.wilayaName,
      city: order.city,
      address: order.address,
    })

    if (order.created) after(() => sendNewOrderEmails(db, order.id).catch((e) => console.error("[king253] order email", e)))

    return { ok: true, number: order.number, token: order.accessToken }
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.userMessage, fields: error.fields }
    if (error instanceof OutOfStockError) return { ok: false, error: error.userMessage, stock: true }
    if (error instanceof AppError) return { ok: false, error: error.userMessage }
    return { ok: false, error: toUserMessage(error) }
  }
}

/**
 * Saves partially-entered details as the customer types (debounced), so a
 * returning Buy Now is prefilled and abandoned carts show who they were.
 */
export async function saveCheckoutDraftAction(raw: Record<string, unknown>, mode: "buy_now" | "cart") {
  const str = (k: string, max = 300) => (typeof raw[k] === "string" ? (raw[k] as string).trim().slice(0, max) || null : null)
  const num = (k: string) => {
    const n = Number(raw[k])
    return Number.isInteger(n) && n > 0 ? n : null
  }
  const phone = str("phone", 40)
  const profileId = await ensureProfileId()
  await saveCheckoutProfile(db, profileId, {
    fullName: str("fullName", 120),
    age: num("age"),
    phone: phone ? (normalizePhone(phone) ?? null) : null,
    email: str("email", 200),
    wilaya: str("wilaya", 80),
    city: str("city", 120),
    address: str("address"),
  })
  if (mode === "cart") {
    const cartId = await readCartId()
    if (cartId && (str("fullName") || phone)) await markInfoEntered(db, cartId, profileId)
  }
}
