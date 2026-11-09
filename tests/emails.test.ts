import { beforeEach, describe, expect, it, vi } from "vitest"

const sent: { to: string; subject: string; html: string }[] = []
vi.mock("@/server/email/transport", () => ({
  getTransport: () => ({ sendMail: async (m: { to: string; subject: string; html: string }) => void sent.push(m) }),
  fromAddress: () => "KING 253 <test@example.test>",
}))

import { notifications } from "@/server/db/schema"
import { sendNewOrderEmails, sendStatusEmail } from "@/server/email/send"
import { createOrder } from "@/server/orders/create"
import { saveSettings } from "@/server/settings"
import { customer, key, resetDb, seedDelivery, seedProduct, testDb, testShop } from "./support/db"

beforeEach(async () => {
  await resetDb()
  sent.length = 0
})

describe("Emails", () => {
  it("a new order is emailed only to its departure shop, with delivery and source", async () => {
    await saveSettings(testDb, { adminNotifyEmail: "admin@example.test" })
    const { wilaya } = await seedDelivery()
    await testShop("other-shop")
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 2 }] })
    const order = await createOrder(testDb, {
      customer: customer({ wilaya, email: "buyer@example.test" }),
      lines: [{ variantId: tee.variants[0].id, quantity: 1 }],
      referralSource: "tiktok",
      idempotencyKey: key(),
    })
    await sendNewOrderEmails(testDb, order.id)
    expect(sent.map((m) => m.to)).toEqual([tee.shop.notificationEmail])
    expect(sent[0].subject).toContain(order.number)
    expect(sent[0].html).toContain("TikTok")
    expect(sent[0].html).toContain("À domicile")
    expect(sent[0].html).toContain("taille M × 1")
  })

  it("the customer gets only the Delivered email, in their language, and only with an email", async () => {
    const { wilaya } = await seedDelivery()
    const tee = await seedProduct({ slug: "tee", price: 2000, variants: [{ size: "M", color: "Black", physical: 3 }] })
    const withEmail = await createOrder(testDb, {
      customer: customer({ wilaya, email: "buyer@example.test" }),
      lines: [{ variantId: tee.variants[0].id, quantity: 1 }],
      locale: "ar",
      idempotencyKey: key(),
    })
    for (const status of ["confirmed", "preparing", "ready_for_delivery", "cancelled"]) await sendStatusEmail(testDb, withEmail.id, status)
    expect(sent).toHaveLength(0)
    await sendStatusEmail(testDb, withEmail.id, "delivered")
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: "buyer@example.test" })
    expect(sent[0].subject).toContain("تم توصيل طلبك")
    expect(sent[0].html).toContain('dir="rtl"')

    const noEmail = await createOrder(testDb, {
      customer: customer({ wilaya, phone: "0550000009" }),
      lines: [{ variantId: tee.variants[0].id, quantity: 1 }],
      idempotencyKey: key(),
    })
    await sendStatusEmail(testDb, noEmail.id, "delivered")
    expect(sent).toHaveLength(1)
    expect((await testDb.select().from(notifications)).map((n) => n.template)).toEqual(["customer_delivered"])
  })
})
