import { and, eq, isNull } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import { notifications, orderItems, orders } from "../db/schema"
import { getSettings } from "../settings"
import { adminNewOrderEmail, customerOrderEmail, type CustomerEmailEvent, type EmailOrder } from "./templates"
import { fromAddress, getTransport } from "./transport"

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

async function loadEmailOrder(db: DbOrTx, orderId: string): Promise<EmailOrder | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  if (!order) return null
  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNull(orderItems.removedAt)))
  const [lead] = order.shipsWithOrderId ? await db.select({ number: orders.number }).from(orders).where(eq(orders.id, order.shipsWithOrderId)) : []
  return { ...order, items, shipsWithNumber: lead?.number ?? null }
}

async function deliver(
  db: DbOrTx,
  msg: { to: string; subject: string; html: string; text: string; template: string; orderId: string; brand: string }
) {
  const transport = getTransport()
  if (!transport) {
    await db.insert(notifications).values({
      recipient: msg.to,
      subject: msg.subject,
      template: msg.template,
      status: "skipped",
      error: "SMTP is not configured (set SMTP_HOST in the environment).",
      orderId: msg.orderId,
    })
    return
  }
  try {
    await transport.sendMail({ from: fromAddress(msg.brand), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text })
    await db.insert(notifications).values({ recipient: msg.to, subject: msg.subject, template: msg.template, status: "sent", orderId: msg.orderId })
  } catch (error) {
    console.error("[king253] email failed", error)
    await db.insert(notifications).values({
      recipient: msg.to,
      subject: msg.subject,
      template: msg.template,
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      orderId: msg.orderId,
    })
  }
}

/** New order: admin alert + customer "received" email (only if they gave an email). */
export async function sendNewOrderEmails(db: DbOrTx, orderId: string) {
  const [order, settings] = await Promise.all([loadEmailOrder(db, orderId), getSettings(db)])
  if (!order) return
  const adminTo = settings.adminNotifyEmail || settings.contactEmail
  if (adminTo) {
    const mail = adminNewOrderEmail(settings.brandName, order, `${siteUrl()}/admin/orders/${orderId}`)
    await deliver(db, { ...mail, to: adminTo, template: "admin_new_order", orderId, brand: settings.brandName })
  }
  if (order.customerEmail && settings.customerEmailsEnabled) {
    const mail = customerOrderEmail(settings.brandName, "received", order, `${siteUrl()}/track?number=${encodeURIComponent(order.number)}`)
    await deliver(db, { ...mail, to: order.customerEmail, template: "customer_received", orderId, brand: settings.brandName })
  }
}

const STATUS_EMAILS: Partial<Record<string, CustomerEmailEvent>> = {
  confirmed: "confirmed",
  preparing: "preparing",
  ready_for_delivery: "ready_for_delivery",
  delivered: "delivered",
}

/** Lifecycle email for a status change — skipped when the customer gave no email. */
export async function sendStatusEmail(db: DbOrTx, orderId: string, status: string) {
  const event = STATUS_EMAILS[status]
  if (!event) return
  const [order, settings] = await Promise.all([loadEmailOrder(db, orderId), getSettings(db)])
  if (!order?.customerEmail || !settings.customerEmailsEnabled) return
  const mail = customerOrderEmail(settings.brandName, event, order, `${siteUrl()}/track?number=${encodeURIComponent(order.number)}`)
  await deliver(db, { ...mail, to: order.customerEmail, template: `customer_${event}`, orderId, brand: settings.brandName })
}
