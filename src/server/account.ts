import { and, desc, eq, isNull, ne, sql } from "drizzle-orm"
import { z } from "zod"

import type { Db, DbOrTx } from "./db/client"
import { orderItems, orders, sessions, users } from "./db/schema"
import { audit } from "./audit"
import { hashPassword, passwordProblem, verifyPassword } from "./auth/password"
import { removeAccountRecords } from "./admin/users"
import { AppError, NotFoundError } from "./errors"
import { findCommune, findWilaya } from "@/lib/algeria"
import { normalizePhone } from "@/lib/phone"

/**
 * A delivered order whose every item went back on a return the shop accepted
 * (approved, received or completed). Exchanges don't count: the customer
 * still has clothes from that order.
 */
const fullyReturnedSql = sql<boolean>`(${orders.status} = 'delivered' and not exists (
  select 1 from order_items oi
  where oi.order_id = "orders"."id" and oi.removed_at is null
    and oi.quantity > coalesce((select sum(r.quantity) from return_requests r
      where r.order_item_id = oi.id and r.type = 'return' and r.status in ('approved', 'received', 'completed')), 0)))`

/* ------------------------------------------------------------------ */
/* What the customer sees on /account                                 */
/* ------------------------------------------------------------------ */

export async function getAccount(db: DbOrTx, userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
      wilaya: users.wilaya,
      city: users.city,
      address: users.address,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
  if (!user) throw new NotFoundError("This account")
  return user
}

/** Orders placed while signed in to this account, newest first, with their items. */
export async function accountOrders(db: DbOrTx, userId: string) {
  const list = await db
    .select({
      id: orders.id,
      number: orders.number,
      accessToken: orders.accessToken,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      wilaya: orders.wilayaName,
      city: orders.city,
      returned: fullyReturnedSql,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), isNull(orders.hiddenByCustomerAt)))
    .orderBy(desc(orders.createdAt))
    .limit(50)
  if (!list.length) return []
  const items = await db
    .select({
      orderId: orderItems.orderId,
      name: orderItems.productName,
      size: orderItems.size,
      color: orderItems.color,
      quantity: orderItems.quantity,
      imageUrl: orderItems.imageUrl,
    })
    .from(orderItems)
    .where(and(sql`${orderItems.orderId} in (select o.id from orders o where o.user_id = ${userId})`, isNull(orderItems.removedAt)))
  return list.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }))
}

/* ------------------------------------------------------------------ */
/* Edit / remove                                                      */
/* ------------------------------------------------------------------ */

const detailsInput = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  phone: z.string().trim().max(40).optional().default(""),
  wilaya: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
})
export type DetailsInput = z.input<typeof detailsInput>

/** Name, phone and delivery address. The address must be on the official map (or left empty). */
export async function updateAccountDetails(db: Db, userId: string, raw: DetailsInput) {
  const parsed = detailsInput.safeParse(raw)
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check your details.")
  const d = parsed.data

  let phone: string | null = null
  if (d.phone) {
    phone = normalizePhone(d.phone)
    if (!phone) throw new AppError("INVALID_PHONE", "Enter a valid Algerian mobile number (05, 06 or 07 followed by 8 digits).")
  }

  let wilaya: string | null = null
  let city: string | null = null
  if (d.wilaya || d.city) {
    const w = findWilaya(d.wilaya)
    if (!w) throw new AppError("INVALID_WILAYA", "Choose your wilaya from the list.")
    const c = findCommune(w, d.city)
    if (!c) throw new AppError("INVALID_CITY", `Choose your commune in ${w.fr}.`)
    wilaya = w.fr
    city = c
  }
  if (d.address && (!wilaya || !city)) throw new AppError("ADDRESS_INCOMPLETE", "Choose your wilaya and commune too.")
  if (d.address && d.address.length < 4) throw new AppError("INVALID_ADDRESS", "Enter your street address.")

  const [updated] = await db
    .update(users)
    .set({ name: d.name, phone, wilaya, city, address: d.address || null, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id })
  if (!updated) throw new NotFoundError("This account")
}

/** "Remove my address": phone stays, delivery details are cleared. */
export async function removeAccountAddress(db: Db, userId: string) {
  await db.update(users).set({ wilaya: null, city: null, address: null, updatedAt: new Date() }).where(eq(users.id, userId))
}

export async function changeAccountPassword(db: Db, userId: string, current: string, next: string, keepSessionId?: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new NotFoundError("This account")
  if (!(await verifyPassword(current, user.passwordHash))) throw new AppError("WRONG_PASSWORD", "Your current password is not correct.")
  const problem = passwordProblem(next)
  if (problem) throw new AppError("WEAK_PASSWORD", problem)
  await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, userId))
  // Signed out everywhere else; this device stays signed in.
  await db.delete(sessions).where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId))
}

/**
 * Customer deletes their own account (password required). Orders stay with
 * the shop as sales history. Admin accounts are removed from the admin panel.
 */
export async function deleteOwnAccount(db: Db, userId: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new NotFoundError("This account")
  if (user.role === "admin") throw new AppError("ADMIN_ACCOUNT", "Admin accounts are removed from Admin → Users by another admin.")
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError("WRONG_PASSWORD", "Your password is not correct.")
  await db.transaction(async (tx) => {
    await removeAccountRecords(tx, userId)
    await audit(tx, { userId: null, label: "Customer" }, "user.delete_self", "user", userId, { email: user.email })
  })
}

/**
 * Removes an order from the customer's own list: cancelled orders, and
 * orders fully returned with the shop's approval. The shop keeps the order.
 */
export async function hideOrderFromAccount(db: Db, userId: string, orderId: string) {
  const [order] = await db
    .select({ id: orders.id, status: orders.status, returned: fullyReturnedSql })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
  if (!order) throw new NotFoundError("This order")
  if (order.status !== "cancelled" && !order.returned) {
    throw new AppError("NOT_REMOVABLE", "Only cancelled orders, or orders fully returned and accepted by the shop, can be removed.")
  }
  await db.update(orders).set({ hiddenByCustomerAt: new Date() }).where(eq(orders.id, order.id))
}
