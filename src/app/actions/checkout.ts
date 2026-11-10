"use server"

import { after } from "next/server"
import { z } from "zod"

import { formatClosureDate, shopClosure } from "@/lib/closure"
import { findWilaya } from "@/lib/algeria"
import { normalizePhone } from "@/lib/phone"
import { isReferralSource } from "@/lib/referral"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { getCurrentUser, startSession } from "@/server/auth/session"
import { createUser, findUserByPhone, passwordMatches } from "@/server/auth/users"
import { passwordProblem } from "@/server/auth/password"
import { shopsThatCanFulfil } from "@/server/inventory"
import { quoteShops, type ShopQuote } from "@/server/shipping"
import { createOrderSchema, fieldErrors } from "@/server/validation"
import { eq } from "drizzle-orm"
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

const linesInput = {
  mode: z.enum(["buy_now", "cart"]),
  buyNow: z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(20) }).optional(),
}

const placeOrderInput = z.object({
  ...linesInput,
  idempotencyKey: z.string().min(16).max(100),
  customer: z.record(z.string(), z.unknown()),
  storeId: z.number().int().positive().nullable().optional(),
  delivery: z.object({ type: z.enum(["home", "desk"]), deskId: z.number().int().positive().nullable().optional() }),
  referralSource: z.string().max(20).nullable().optional(),
  locale: z.enum(["ar", "fr", "en"]).nullable().optional(),
  /** Guests: password for the account created (or matched) by phone. */
  account: z.object({ password: z.string().max(200).default(""), forgot: z.boolean().default(false) }).optional(),
})

type LinesResult = { ok: true; lines: { variantId: string; quantity: number }[]; cartId: string | null } | { ok: false; error: string; stock?: boolean }

/** The order's lines: the server-side bag (never trusting the browser) or the Buy Now line. */
async function resolveLines(input: { mode: "buy_now" | "cart"; buyNow?: { variantId: string; quantity: number } }): Promise<LinesResult> {
  if (input.mode === "buy_now") {
    if (!input.buyNow) return { ok: false, error: "Choose a size first." }
    return { ok: true, lines: [input.buyNow], cartId: null }
  }
  const cartId = await readCartId()
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
  if (!cart.length) return { ok: false, error: "Your bag is empty." }
  return { ok: true, lines: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), cartId }
}

export type CheckoutQuote =
  | { ok: true; shops: ShopQuote[] }
  | { ok: false; error: string; reason: "no_shop" | "stock" | "input" }

/**
 * Shops that can ship the whole order to this wilaya, with their delivery
 * price for the chosen type, cheapest first. Called live by the checkout form.
 */
export async function quoteCheckoutAction(raw: unknown): Promise<CheckoutQuote> {
  try {
    const input = z
      .object({ ...linesInput, wilaya: z.string().max(80), city: z.string().max(120).default(""), type: z.enum(["home", "desk"]) })
      .parse(raw)
    if (!rateLimit(`quote:${await clientIp()}`, 120, 60_000).ok) return { ok: false, reason: "input", error: "Too many requests — wait a moment." }
    const wilaya = findWilaya(input.wilaya)
    if (!wilaya) return { ok: false, reason: "input", error: "Choose your wilaya." }
    const resolved = await resolveLines(input)
    if (!resolved.ok) return { ok: false, reason: "stock", error: resolved.error }
    const shops = await shopsThatCanFulfil(db, resolved.lines)
    if (!shops.length) {
      return { ok: false, reason: "no_shop", error: "No single shop has every item of your order in stock. Remove an item or lower a quantity." }
    }
    const quotes = await quoteShops(db, { shops, wilayaCode: wilaya.code, wilayaName: wilaya.fr, commune: input.city, type: input.type })
    return { ok: true, shops: quotes }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, reason: "input", error: "Check your details." }
    return { ok: false, reason: "input", error: toUserMessage(error) }
  }
}

const PHONE_HAS_ACCOUNT =
  "This phone number already has a KING 253 account. Enter its password to sign in, or tick “I forgot my password”."

/**
 * One checkout, one order. Guests get an account automatically, identified by
 * their phone (no duplicates: a known phone signs in with its password).
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
    // Per phone number too: the same person cannot flood the shop with orders from many networks.
    if (!rateLimit(`order-phone:${String(input.customer?.phone ?? "").replace(/\D/g, "").slice(-9)}`, 5, 10 * 60_000).ok) {
      return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." }
    }
    const resolved = await resolveLines(input)
    if (!resolved.ok) return resolved
    const { lines, cartId } = resolved

    const orderInput = {
      customer: input.customer as never,
      lines,
      storeId: input.storeId ?? null,
      delivery: { type: input.delivery.type, deskId: input.delivery.deskId ?? null },
      locale: input.locale ?? null,
      idempotencyKey: input.idempotencyKey,
    }
    // Check the form before creating any account.
    const check = createOrderSchema.safeParse(orderInput)
    if (!check.success) return { ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(check.error) }
    const info = check.data.customer
    const referral = isReferralSource(input.referralSource) ? input.referralSource : null

    const user = await getCurrentUser()
    let userId = user?.id ?? null
    let newAccount = false
    if (!user) {
      const password = input.account?.password ?? ""
      const existing = await findUserByPhone(db, info.phone)
      if (existing) {
        if (password && (await passwordMatches(existing, password))) {
          await startSession(existing.id)
          userId = existing.id
        } else if (input.account?.forgot && !existing.disabledAt && existing.role === "customer") {
          // Same phone, password forgotten: the order joins that account, nobody is signed in.
          userId = existing.id
        } else {
          return { ok: false, error: PHONE_HAS_ACCOUNT, fields: { password: password ? "Wrong password for this phone number." : PHONE_HAS_ACCOUNT } }
        }
      } else {
        const fields: Record<string, string> = {}
        const problem = passwordProblem(password)
        if (problem) fields.password = problem
        if (!referral) fields.referralSource = "Tell us where you heard about us."
        if (Object.keys(fields).length) return { ok: false, error: "Please check the highlighted fields.", fields }
        if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000).ok) return { ok: false, error: "Too many new accounts from here. Try again later." }
        try {
          const created = await createUser(db, {
            name: info.fullName,
            phone: info.phone,
            email: info.email,
            password,
            role: "customer",
            referralSource: referral,
            locale: input.locale ?? null,
          })
          await startSession(created.id)
          userId = created.id
          newAccount = true
        } catch (error) {
          if (error instanceof AppError && error.code === "EMAIL_TAKEN") {
            return { ok: false, error: error.userMessage, fields: { email: "This email already has an account — sign in, or leave the email empty." } }
          }
          throw error
        }
      }
    }

    // Signed-in customers who never answered "where did you hear about us?" answer it once.
    const [account] = userId ? await db.select({ referralSource: users.referralSource }).from(users).where(eq(users.id, userId)) : []
    if (userId && !account?.referralSource && referral) await db.update(users).set({ referralSource: referral }).where(eq(users.id, userId))

    const order = await createOrder(
      db,
      { ...orderInput, referralSource: account?.referralSource ?? referral },
      { userId, cartId, sessionId: await readSessionId() }
    )
    if (newAccount && order.customerId) await db.update(users).set({ customerId: order.customerId }).where(eq(users.id, userId!))

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
