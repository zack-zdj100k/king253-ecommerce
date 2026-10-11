import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { orders, sessions, users } from "@/server/db/schema"
import { accountOrders, changeAccountPassword, deleteOwnAccount, getAccount, hideOrderFromAccount, removeAccountAddress, updateAccountDetails } from "@/server/account"
import { changeOrderStatus } from "@/server/orders/manage"
import { authenticate, createSessionRecord, createUser, hashToken } from "@/server/auth/users"
import { createOrder } from "@/server/orders/create"

import { customer, key, resetDb, seedDelivery, seedProduct, testDb } from "./support/db"

let userId: string

beforeEach(async () => {
  await resetDb()
  userId = (await createUser(testDb, { email: "amine@test.local", name: "Amine", password: "TestPass123", role: "customer" })).id
})

describe("Customer account", () => {
  it("saves name, phone and an address from the official map", async () => {
    await updateAccountDetails(testDb, userId, { name: "Amine B", phone: "0550 12 34 56", wilaya: "16", city: "bab ezzouar", address: "Cité 5 juillet, bt 12" })
    expect(await getAccount(testDb, userId)).toMatchObject({ name: "Amine B", phone: "+213550123456", wilaya: "Alger", city: "Bab Ezzouar", address: "Cité 5 juillet, bt 12" })

    await expect(updateAccountDetails(testDb, userId, { name: "Amine", wilaya: "Alger", city: "Arzew" })).rejects.toThrow(/commune in Alger/)
    await expect(updateAccountDetails(testDb, userId, { name: "Amine", phone: "123" })).rejects.toThrow(/valid Algerian mobile/)

    await removeAccountAddress(testDb, userId)
    expect(await getAccount(testDb, userId)).toMatchObject({ phone: "+213550123456", wilaya: null, city: null, address: null })
  })

  it("lists only this account's orders, with their items", async () => {
    await seedDelivery()
    const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: p.variants[0].id, quantity: 2 }], idempotencyKey: key() }, { userId })
    await createOrder(testDb, { customer: customer({ wilaya: "Alger", phone: "0550000099" }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() })
    const list = await accountOrders(testDb, userId)
    expect(list).toHaveLength(1)
    expect(list[0].items).toEqual([expect.objectContaining({ name: "Product tee", quantity: 2 })])
  })

  it("changes the password and signs out other devices, keeping this one", async () => {
    const here = await createSessionRecord(testDb, userId)
    await createSessionRecord(testDb, userId)
    await expect(changeAccountPassword(testDb, userId, "wrong-pass1", "NewPass12345")).rejects.toThrow(/not correct/)
    await changeAccountPassword(testDb, userId, "TestPass123", "NewPass12345", hashToken(here.token))
    expect(await authenticate(testDb, "amine@test.local", "NewPass12345")).not.toBeNull()
    const left = await testDb.select().from(sessions).where(eq(sessions.userId, userId))
    expect(left.map((s) => s.id)).toEqual([hashToken(here.token)])
  })

  it("deletes the account with the password; orders stay", async () => {
    await seedDelivery()
    const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() }, { userId })
    await expect(deleteOwnAccount(testDb, userId, "nope-nope-1")).rejects.toThrow(/not correct/)
    await deleteOwnAccount(testDb, userId, "TestPass123")
    expect(await testDb.select().from(users).where(eq(users.id, userId))).toHaveLength(0)
    expect((await testDb.select().from(orders).where(eq(orders.id, o.id)))[0].userId).toBeNull()
  })

  it("admins cannot delete themselves from the shop side", async () => {
    const admin = await createUser(testDb, { email: "boss@test.local", name: "Boss", password: "TestPass123", role: "admin" })
    await expect(deleteOwnAccount(testDb, admin.id, "TestPass123")).rejects.toThrow(/Admin accounts/)
  })
})

describe("Removing a cancelled order from My orders", () => {
  it("only cancelled orders of this account; the shop keeps the order", async () => {
    await seedDelivery()
    const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: p.variants[0].id, quantity: 1 }], idempotencyKey: key() }, { userId })
    await expect(hideOrderFromAccount(testDb, userId, o.id)).rejects.toThrow(/Only cancelled orders/)

    const stranger = (await createUser(testDb, { email: "x@test.local", name: "Xavier", password: "TestPass123", role: "customer" })).id
    await changeOrderStatus(testDb, { orderId: o.id, to: "cancelled", actor: { userId: null, label: "Customer" } })
    await expect(hideOrderFromAccount(testDb, stranger, o.id)).rejects.toThrow()

    await hideOrderFromAccount(testDb, userId, o.id)
    expect(await accountOrders(testDb, userId)).toHaveLength(0)
    expect(await testDb.select().from(orders).where(eq(orders.id, o.id))).toHaveLength(1)
  })
})

describe("Removing a returned order from My orders", () => {
  it("allowed once every item is on a return the shop approved", async () => {
    const { approveReturn, createReturnRequest } = await import("@/server/returns")
    const { orderItems } = await import("@/server/db/schema")
    await seedDelivery()
    const p = await seedProduct({ slug: "tee", price: 3000, variants: [{ size: "M", color: "Black", physical: 5 }] })
    const o = await createOrder(testDb, { customer: customer({ wilaya: "Alger" }), lines: [{ variantId: p.variants[0].id, quantity: 2 }], idempotencyKey: key() }, { userId })
    await changeOrderStatus(testDb, { orderId: o.id, to: "delivered", actor: { userId: null, label: "Admin" } })
    const [item] = await testDb.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    const r = await createReturnRequest(testDb, { orderNumber: o.number, phone: o.customerPhone, orderItemId: item.id, type: "return", reason: "Wrong size", quantity: 2 })

    await expect(hideOrderFromAccount(testDb, userId, o.id)).rejects.toThrow(/Only cancelled orders/) // not accepted yet
    await approveReturn(testDb, { id: r.id, actor: { userId: null, label: "Admin" } })
    expect((await accountOrders(testDb, userId))[0].returned).toBe(true)
    await hideOrderFromAccount(testDb, userId, o.id)
    expect(await accountOrders(testDb, userId)).toHaveLength(0)
  })
})
