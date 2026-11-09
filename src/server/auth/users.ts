import { createHash, randomBytes } from "node:crypto"

import { and, eq, gt, sql } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import { sessions, users } from "../db/schema"
import { AppError } from "../errors"
import { normalizePhone } from "@/lib/phone"
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from "./password"

export const SESSION_DAYS = 30

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Email, phone, or both. A checkout account is identified by its phone
 * (unique); a classic sign-up by its email (unique).
 */
export async function createUser(
  db: DbOrTx,
  input: {
    email?: string | null
    phone?: string | null
    name: string
    password: string
    role: "admin" | "customer"
    referralSource?: string | null
    locale?: string | null
    customerId?: string | null
  }
) {
  const email = input.email?.trim().toLowerCase() || null
  const phone = input.phone ? normalizePhone(input.phone) : null
  const name = input.name.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("INVALID_EMAIL", "Enter a valid email address.")
  if (input.phone && !phone) throw new AppError("INVALID_PHONE", "Enter a valid Algerian mobile number (05, 06 or 07 followed by 8 digits).")
  if (!email && !phone) throw new AppError("INVALID_EMAIL", "Enter your email or phone number.")
  if (name.length < 2) throw new AppError("INVALID_NAME", "Enter your name.")
  const problem = passwordProblem(input.password)
  if (problem) throw new AppError("WEAK_PASSWORD", problem)

  if (email) {
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`)
    if (existing) throw new AppError("EMAIL_TAKEN", "An account with this email already exists. Sign in instead.")
  }
  if (phone) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.loginPhone, phone))
    if (existing) throw new AppError("PHONE_TAKEN", "An account with this phone number already exists. Sign in instead.")
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      loginPhone: phone,
      phone,
      name,
      role: input.role,
      referralSource: input.referralSource ?? null,
      locale: input.locale ?? null,
      customerId: input.customerId ?? null,
      passwordHash: await hashPassword(input.password),
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role })
  return user
}

/** The account that signs in with this phone number, if any. */
export async function findUserByPhone(db: DbOrTx, phoneInput: string) {
  const phone = normalizePhone(phoneInput)
  if (!phone) return null
  const [user] = await db.select().from(users).where(eq(users.loginPhone, phone))
  return user ?? null
}

/**
 * Sign in with an email OR a phone number. Returns the user or null. Always
 * runs a hash so timing does not leak which accounts exist.
 */
export async function authenticate(db: DbOrTx, identifier: string, password: string) {
  const raw = identifier.trim()
  const phone = raw.includes("@") ? null : normalizePhone(raw)
  const [user] = phone
    ? await db.select().from(users).where(eq(users.loginPhone, phone))
    : await db.select().from(users).where(sql`lower(${users.email}) = ${raw.toLowerCase()}`)
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok || user.disabledAt) return null
  return user
}

/** Checks a password for a known user (same timing as authenticate). */
export async function passwordMatches(user: { passwordHash: string; disabledAt: Date | null }, password: string) {
  const ok = await verifyPassword(password, user.passwordHash)
  return ok && !user.disabledAt
}

export async function createSessionRecord(db: DbOrTx, userId: string) {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt })
  return { token, expiresAt }
}

export async function userForSessionToken(db: DbOrTx, token: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      loginPhone: users.loginPhone,
      name: users.name,
      role: users.role,
      customerId: users.customerId,
      locale: users.locale,
      disabledAt: users.disabledAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
  if (!row || row.disabledAt) return null
  return row
}

export async function deleteSessionRecord(db: DbOrTx, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)))
}
