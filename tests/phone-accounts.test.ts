import { beforeEach, describe, expect, it } from "vitest"

import { getAccount, updateAccountDetails } from "@/server/account"
import { authenticate, createUser, findUserByPhone } from "@/server/auth/users"
import { resetDb, testDb } from "./support/db"

const PASSWORD = "test-password-123"

beforeEach(async () => {
  await resetDb()
})

describe("Accounts by phone", () => {
  it("a checkout account has a phone and no email; it signs in with the phone in any format", async () => {
    const u = await createUser(testDb, { name: "Test Customer", phone: "0550 00 00 01", password: PASSWORD, role: "customer", referralSource: "tiktok" })
    expect(u.email).toBeNull()
    expect((await findUserByPhone(testDb, "+213550000001"))?.id).toBe(u.id)
    expect((await authenticate(testDb, "0550000001", PASSWORD))?.id).toBe(u.id)
    expect(await authenticate(testDb, "0550000001", "wrong-password")).toBeNull()
    await expect(createUser(testDb, { name: "Someone", phone: "+213550000001", password: PASSWORD, role: "customer" })).rejects.toThrow(/phone number already exists/)
  })

  it("email or phone sign-in for the same account; adding an email later", async () => {
    const u = await createUser(testDb, { name: "Test Customer", phone: "0660000002", password: PASSWORD, role: "customer" })
    await updateAccountDetails(testDb, u.id, { name: "Test Customer", email: "customer@example.test", phone: "0660000002" })
    expect((await getAccount(testDb, u.id)).email).toBe("customer@example.test")
    expect((await authenticate(testDb, "CUSTOMER@example.test", PASSWORD))?.id).toBe(u.id)
    expect((await authenticate(testDb, "0660000002", PASSWORD))?.id).toBe(u.id)
  })

  it("never leaves an account without a way to sign in, and never shares a sign-in phone", async () => {
    const a = await createUser(testDb, { name: "Customer A", phone: "0770000003", password: PASSWORD, role: "customer" })
    const b = await createUser(testDb, { name: "Customer B", email: "b@example.test", password: PASSWORD, role: "customer" })
    await expect(updateAccountDetails(testDb, a.id, { name: "Customer A", phone: "" })).rejects.toThrow(/sign in with it/)
    // B saves A's number as delivery phone: allowed, but it does not become B's sign-in phone.
    await updateAccountDetails(testDb, b.id, { name: "Customer B", phone: "0770000003" })
    expect((await findUserByPhone(testDb, "0770000003"))?.id).toBe(a.id)
  })
})
