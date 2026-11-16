"use server"

import { redirect, RedirectType } from "next/navigation"
import { z } from "zod"

import { db } from "@/server/db"
import { endSession, startSession } from "@/server/auth/session"
import { authenticate, createUser } from "@/server/auth/users"
import { toUserMessage } from "@/server/errors"
import { isRateLimited, rateLimit } from "@/server/rate-limit"
import { clientIp } from "@/server/request"
import { safeLocalPath } from "@/lib/request-safety"
import { isReferralSource } from "@/lib/referral"

export type AuthResult = { ok: false; error: string } | undefined

/** Only same-site relative paths are allowed as a post-login destination. */
function safeNext(value: unknown, fallback: string) {
  return safeLocalPath(value) ?? fallback
}

const LOGIN_WINDOW = 15 * 60_000
/** Failed passwords per account, from any address: stops guessing even when the address changes. */
const ACCOUNT_FAILURES = 10

export async function signInAction(raw: { email: string; password: string; next?: string }): Promise<AuthResult> {
  const ip = await clientIp()
  if (!rateLimit(`login:${ip}`, 10, LOGIN_WINDOW).ok) return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." }
  const email = String(raw.email ?? "").slice(0, 200)
  const accountKey = `login-fail:${email.trim().toLowerCase()}`
  if (isRateLimited(accountKey, ACCOUNT_FAILURES, LOGIN_WINDOW)) return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." }
  const user = await authenticate(db, email, String(raw.password ?? "").slice(0, 200))
  if (!user) {
    rateLimit(accountKey, ACCOUNT_FAILURES, LOGIN_WINDOW)
    return { ok: false, error: "Email/phone or password is incorrect." }
  }
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
