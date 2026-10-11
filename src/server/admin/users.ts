import { and, desc, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm"

import type { Db, DbOrTx, Tx } from "../db/client"
import { auditLogs, carts, orderStatusHistory, reviews, sessions, stockMovements, users } from "../db/schema"
import { audit, type Actor } from "../audit"
import { createUser } from "../auth/users"
import { AppError, NotFoundError } from "../errors"

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)
export const USERS_PAGE = 30

/** Account numbers for the Users page header. */
export async function userStats(db: DbOrTx) {
  const day = 86_400_000
  const since = (days: number) => sql`${new Date(Date.now() - days * day).toISOString()}::timestamptz`
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      customers: sql<number>`count(*) filter (where ${users.role} = 'customer')::int`,
      admins: sql<number>`count(*) filter (where ${users.role} = 'admin')::int`,
      blocked: sql<number>`count(*) filter (where ${users.disabledAt} is not null)::int`,
      today: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(1)})::int`,
      week: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(7)})::int`,
      month: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(30)})::int`,
      withOrders: sql<number>`count(*) filter (where exists (select 1 from orders o where o.user_id = "users"."id"))::int`,
    })
    .from(users)
  // Sign-ups per day for the last 30 days (Algiers time).
  const byDay = (await db.execute(sql`
    select to_char(created_at at time zone 'Africa/Algiers', 'YYYY-MM-DD') as day, count(*)::int as count
    from users where created_at >= ${since(30)} group by 1 order by 1
  `)) as unknown as { day: string; count: number }[]
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * day).toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" })
    return { day: d, count: byDay.find((b) => b.day === d)?.count ?? 0 }
  })
  return { ...row, days }
}

export async function listUsers(db: DbOrTx, f: { q?: string; role?: string; page?: number }) {
  const where: SQL[] = []
  if (f.q?.trim()) {
    const pat = `%${escapeLike(f.q.trim())}%`
    where.push(or(ilike(users.email, pat), ilike(users.name, pat))!)
  }
  if (f.role === "admin" || f.role === "customer") where.push(eq(users.role, f.role))
  if (f.role === "blocked") where.push(sql`${users.disabledAt} is not null`)
  const page = Math.max(1, f.page ?? 1)
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
      referralSource: users.referralSource,
      orders: sql<number>`(select count(*)::int from orders o where o.user_id = "users"."id")`,
      lastSeen: sql<Date | null>`(select max(s.created_at) from sessions s where s.user_id = "users"."id")`,
      count: sql<number>`count(*) over()::int`,
    })
    .from(users)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(USERS_PAGE)
    .offset((page - 1) * USERS_PAGE)
  const total = rows[0]?.count ?? 0
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / USERS_PAGE)) }
}

/* ------------------------------------------------------------------ */
/* Safety: the shop must never lose its last way into the admin.      */
/* ------------------------------------------------------------------ */

async function loadTarget(db: DbOrTx, id: string, actor: Actor) {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  if (!user) throw new NotFoundError("This account")
  if (user.id === actor.userId) throw new AppError("SELF", "You can't change or delete your own account here.")
  return user
}

async function assertNotLastAdmin(db: DbOrTx, user: typeof users.$inferSelect) {
  if (user.role !== "admin" || user.disabledAt) return
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), isNull(users.disabledAt), ne(users.id, user.id)))
  if (n === 0) throw new AppError("LAST_ADMIN", "This is the last active admin. Make someone else admin first.")
}

export async function setUserRole(db: Db, id: string, role: "admin" | "customer", actor: Actor) {
  const user = await loadTarget(db, id, actor)
  if (user.role === role) return user
  if (role === "customer") await assertNotLastAdmin(db, user)
  const [updated] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id)).returning()
  // Admin rights change immediately: existing sessions are signed out.
  await db.delete(sessions).where(eq(sessions.userId, id))
  await audit(db, actor, "user.role", "user", id, { email: user.email, from: user.role, to: role })
  return updated
}

/** Blocked accounts cannot sign in; they are signed out everywhere at once. */
export async function setUserBlocked(db: Db, id: string, blocked: boolean, actor: Actor) {
  const user = await loadTarget(db, id, actor)
  if (blocked) await assertNotLastAdmin(db, user)
  const [updated] = await db
    .update(users)
    .set({ disabledAt: blocked ? new Date() : null, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  if (blocked) await db.delete(sessions).where(eq(sessions.userId, id))
  await audit(db, actor, blocked ? "user.block" : "user.unblock", "user", id, { email: user.email })
  return updated
}

/**
 * Deletes an account. Orders stay (they are sales history) but are no longer
 * linked to it; wishlist and sessions go with it; history keeps who did what
 * as an anonymous "deleted user".
 */
export async function deleteUser(db: Db, id: string, actor: Actor) {
  const user = await loadTarget(db, id, actor)
  await assertNotLastAdmin(db, user)
  await db.transaction(async (tx) => {
    await removeAccountRecords(tx, id)
    await audit(tx, actor, "user.delete", "user", id, { email: user.email, role: user.role })
  })
  return user
}

/** Deletes an account row; orders stay (unlinked), history keeps an anonymous actor. */
export async function removeAccountRecords(tx: Tx, id: string) {
  await tx.update(auditLogs).set({ actorUserId: null }).where(eq(auditLogs.actorUserId, id))
  await tx.update(stockMovements).set({ actorUserId: null }).where(eq(stockMovements.actorUserId, id))
  await tx.update(orderStatusHistory).set({ actorUserId: null }).where(eq(orderStatusHistory.actorUserId, id))
  await tx.update(reviews).set({ moderatedBy: null }).where(eq(reviews.moderatedBy, id))
  await tx.update(carts).set({ userId: null }).where(eq(carts.userId, id))
  await tx.delete(users).where(eq(users.id, id))
}

/** A second admin (manager) with their own email and password. */
export async function createAdminUser(db: Db, input: { email: string; name: string; password: string }, actor: Actor) {
  const user = await createUser(db, { ...input, role: "admin" })
  await audit(db, actor, "user.create_admin", "user", user.id, { email: user.email })
  return user
}
