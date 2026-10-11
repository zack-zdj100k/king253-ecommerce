"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/server/db"
import { changeAccountPassword, deleteOwnAccount, hideOrderFromAccount, removeAccountAddress, updateAccountDetails, type DetailsInput } from "@/server/account"
import { getCurrentUser, SESSION_COOKIE } from "@/server/auth/session"
import { hashToken } from "@/server/auth/users"
import { toUserMessage } from "@/server/errors"
import { rateLimit } from "@/server/rate-limit"

export type AccountResult = { ok: true; message: string } | { ok: false; error: string }

/** Every account change is checked against the signed-in user on the server. */
async function asUser<T>(run: (userId: string) => Promise<T>, message: string): Promise<AccountResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Please sign in again." }
  if (!rateLimit(`account:${user.id}`, 30, 60_000).ok) return { ok: false, error: "Too many changes — wait a minute." }
  try {
    await run(user.id)
    revalidatePath("/account")
    return { ok: true, message }
  } catch (error) {
    return { ok: false, error: toUserMessage(error) }
  }
}

export async function updateDetailsAction(input: DetailsInput) {
  return asUser((id) => updateAccountDetails(db, id, input), "Your details are saved.")
}

export async function removeAddressAction() {
  return asUser((id) => removeAccountAddress(db, id), "Your address was removed.")
}

export async function changePasswordAction(current: string, next: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return asUser(
    (id) => changeAccountPassword(db, id, String(current).slice(0, 200), String(next).slice(0, 200), token ? hashToken(token) : undefined),
    "Password changed. Other devices were signed out."
  )
}

export async function deleteAccountAction(password: string): Promise<AccountResult> {
  const result = await asUser((id) => deleteOwnAccount(db, id, String(password).slice(0, 200)), "Account deleted.")
  if (!result.ok) return result
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/?account=deleted")
}

export async function removeCancelledOrderAction(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId))) return { ok: false, error: "Order not found." } satisfies AccountResult
  return asUser((id) => hideOrderFromAccount(db, id, String(orderId)), "Order removed from your list.")
}
