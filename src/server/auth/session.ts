import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { db } from "../db"
import { ForbiddenError } from "../errors"
import { createSessionRecord, deleteSessionRecord, userForSessionToken } from "./users"

export const SESSION_COOKIE = "k253_session"

/** Current signed-in user for this request (memoised per render). */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return userForSessionToken(db, token)
})

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/** Call only from Server Actions / Route Handlers (cookies are writable there). */
export async function startSession(userId: string) {
  const { token, expiresAt } = await createSessionRecord(db, userId)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await deleteSessionRecord(db, token)
  jar.delete(SESSION_COOKIE)
}

/** For admin pages: redirect to the admin login when not an admin. */
export async function requireAdminPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") redirect("/admin/login")
  return user
}

/** For admin Server Actions: never trust the UI — check again on the server. */
export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") throw new ForbiddenError()
  return user
}

export function actorOf(user: CurrentUser) {
  return { userId: user.id, label: user.name }
}
