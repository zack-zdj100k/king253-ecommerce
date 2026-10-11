import { createHash, randomBytes } from "node:crypto"

import { and, eq, gt, sql } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import { sessions, users } from "../db/schema"
import { AppError } from "../errors"
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from "./password"

export const SESSION_DAYS = 30

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function createUser(
  db: DbOrTx,
  input: { email: string; name: string; password: string; role: "admin" | "customer"; referralSource?: string | null }
) {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("INVALID_EMAIL", "Enter a valid email address.")
  if (name.length < 2) throw new AppError("INVALID_NAME", "Enter your name.")
  const problem = passwordProblem(input.password)
  if (problem) throw new AppError("WEAK_PASSWORD", problem)

  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`)
  if (existing) throw new AppError("EMAIL_TAKEN", "An account with this email already exists. Sign in instead.")

  const [user] = await db
    .insert(users)
    .values({ email, name, role: input.role, referralSource: input.referralSource ?? null, passwordHash: await hashPassword(input.password) })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role })
  return user
}

/** Returns the user or null. Always runs a hash so timing does not leak which emails exist. */
export async function authenticate(db: DbOrTx, emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase()
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`)
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok || user.disabledAt) return null
  return user
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
      name: users.name,
      role: users.role,
      customerId: users.customerId,
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
