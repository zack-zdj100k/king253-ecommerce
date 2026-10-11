import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { auditLogs, orders, sessions, users } from "@/server/db/schema"
import { createAdminUser, deleteUser, listUsers, setUserBlocked, setUserRole, userStats } from "@/server/admin/users"
import { authenticate, createSessionRecord, createUser } from "@/server/auth/users"
import { createOrder } from "@/server/orders/create"

import { customer, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

let me: { userId: string; label: string }

beforeEach(async () => {
  await resetDb()
  const admin = await createUser(testDb, { email: "boss@test.local", name: "Boss", password: "TestPass123", role: "admin" })
  me = { userId: admin.id, label: "Boss" }
})

const newCustomer = (email = "client@test.local") => createUser(testDb, { email, name: "Client", password: "TestPass123", role: "customer" })

describe("Users admin", () => {
  it("counts accounts and new sign-ups", async () => {
    await newCustomer()
    await newCustomer("client2@test.local")
    const stats = await userStats(testDb)
    expect(stats).toMatchObject({ total: 3, customers: 2, admins: 1, today: 3, week: 3, month: 3 })
    expect(stats.days).toHaveLength(30)
    expect(stats.days.at(-1)!.count).toBe(3)
    expect((await listUsers(testDb, { role: "customer" })).total).toBe(2)
    expect((await listUsers(testDb, { q: "client2" })).rows.map((r) => r.email)).toEqual(["client2@test.local"])
  })

  it("promotes a second admin and signs them out so the new rights apply", async () => {
    const c = await newCustomer()
    await createSessionRecord(testDb, c.id)
    await setUserRole(testDb, c.id, "admin", me)
    expect((await testDb.select().from(users).where(eq(users.id, c.id)))[0].role).toBe("admin")
    expect(await testDb.select().from(sessions).where(eq(sessions.userId, c.id))).toHaveLength(0)
  })

  it("creates a manager admin that can sign in", async () => {
    await createAdminUser(testDb, { email: "manager@test.local", name: "Manager", password: "ManagerPass9" }, me)
    expect((await authenticate(testDb, "manager@test.local", "ManagerPass9"))?.role).toBe("admin")
    await expect(createAdminUser(testDb, { email: "x@test.local", name: "Xavier", password: "short" }, me)).rejects.toThrow(/10 characters/)
  })

  it("blocked accounts cannot sign in", async () => {
    const c = await newCustomer()
    await setUserBlocked(testDb, c.id, true, me)
    expect(await authenticate(testDb, "client@test.local", "TestPass123")).toBeNull()
    await setUserBlocked(testDb, c.id, false, me)
    expect(await authenticate(testDb, "client@test.local", "TestPass123")).not.toBeNull()
  })

  it("never lets the shop lose its last admin, and you can't remove yourself", async () => {
    await expect(deleteUser(testDb, me.userId, me)).rejects.toThrow(/your own account/)
    const other = await createAdminUser(testDb, { email: "second@test.local", name: "Second", password: "SecondPass9" }, me)
    const asOther = { userId: other.id, label: "Second" }
    await setUserRole(testDb, me.userId, "customer", asOther) // fine: Second is still admin
    await expect(setUserBlocked(testDb, other.id, true, me)).rejects.toThrow(/last active admin/)
  })

  it("deleting an account keeps its orders and the history", async () => {
    const c = await newCustomer()
    await seedDelivery()
    const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() }, { userId: c.id })
    const adminToDelete = await createAdminUser(testDb, { email: "old@test.local", name: "Old", password: "OldAdminPass9" }, me)
    await setUserRole(testDb, c.id, "admin", { userId: adminToDelete.id, label: "Old" }) // leaves audit history by "Old"

    await deleteUser(testDb, c.id, me)
    await deleteUser(testDb, adminToDelete.id, me)
    expect((await testDb.select().from(orders).where(eq(orders.id, o.id)))[0].userId).toBeNull()
    expect((await testDb.select().from(auditLogs).where(eq(auditLogs.action, "user.delete")))).toHaveLength(2)
  })
})
