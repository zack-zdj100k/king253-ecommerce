"use server"

import { redirect, RedirectType } from "next/navigation"
import { z } from "zod"

import { db } from "@/server/db"
import { endSession, startSession } from "@/server/auth/session"
import { authenticate, createUser } from "@/server/auth/users"
import { toUserMessage } from "@/server/errors"
import { rateLimit } from "@/server/rate-limit"
import { clientIp } from "@/server/request"
import { isReferralSource } from "@/lib/referral"

export type AuthResult = { ok: false; error: string } | undefined

/** Only same-site relative paths are allowed as a post-login destination. */
function safeNext(value: unknown, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback
}

export async function signInAction(raw: { email: string; password: string; next?: string }): Promise<AuthResult> {
  const ip = await clientIp()
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000).ok) return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." }
  const email = String(raw.email ?? "").slice(0, 200)
  const user = await authenticate(db, email, String(raw.password ?? "").slice(0, 200))
  if (!user) return { ok: false, error: "Email or password is incorrect." }
  await startSession(user.id)
  // replace: the sign-in page is a detour, so it leaves no history entry.
  redirect(safeNext(raw.next, user.role === "admin" ? "/admin" : "/account"), RedirectType.replace)
}

const signUpInput = z.object({ name: z.string(), email: z.string(), password: z.string(), referralSource: z.string().max(20).optional(), next: z.string().max(500).optional() })

/**
 * Accounts only ever see orders placed while signed in (orders.user_id).
 * Phones are not verified, so we never attach past guest orders by phone —
 * that would expose someone else's history and address.
 */
export async function signUpAction(raw: unknown): Promise<AuthResult> {
  let next = "/account"
  try {
    if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000).ok) return { ok: false, error: "Too many sign-ups from here. Try again later." }
    const data = signUpInput.parse(raw)
    next = safeNext(data.next, "/account")
    const user = await createUser(db, {
      email: data.email,
      name: data.name,
      password: data.password,
      role: "customer",
      referralSource: isReferralSource(data.referralSource) ? data.referralSource : null,
    })
    await startSession(user.id)
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: "Please complete the form." }
    return { ok: false, error: toUserMessage(error) }
  }
  redirect(next, RedirectType.replace)
}

export async function signOutAction() {
  await endSession()
  redirect("/")
}
