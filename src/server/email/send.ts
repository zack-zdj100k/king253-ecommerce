import { and, eq, isNull } from "drizzle-orm"

import type { DbOrTx } from "../db/client"
import { notifications, orderItems, orders, stores, users } from "../db/schema"
import { getSettings } from "../settings"
import { customerDeliveredEmail, shopNewOrderEmail, type EmailLocale, type EmailOrder } from "./templates"
import { fromAddress, getTransport } from "./transport"

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

async function loadEmailOrder(db: DbOrTx, orderId: string) {
  const [row] = await db
    .select({ order: orders, storeName: stores.name, shopEmail: stores.notificationEmail, accountEmail: users.email, accountLocale: users.locale })
    .from(orders)
    .leftJoin(stores, eq(stores.id, orders.storeId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
  if (!row) return null
  const { order } = row
  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNull(orderItems.removedAt)))
  const [lead] = order.shipsWithOrderId ? await db.select({ number: orders.number }).from(orders).where(eq(orders.id, order.shipsWithOrderId)) : []
  const email: EmailOrder = { ...order, storeName: row.storeName, items, shipsWithNumber: lead?.number ?? null }
  const locale = [order.locale, row.accountLocale].find((l): l is EmailLocale => l === "ar" || l === "fr" || l === "en") ?? "fr"
  return { email, accessToken: order.accessToken, shopEmail: row.shopEmail, customerEmail: order.customerEmail ?? row.accountEmail, locale }
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
    // One retry after a short pause: SMTP servers often fail once and then accept.
    try {
      await transport.sendMail({ from: fromAddress(msg.brand), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text })
    } catch {
      await new Promise((r) => setTimeout(r, 1500))
      await transport.sendMail({ from: fromAddress(msg.brand), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text })
    }
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

/**
 * New order: ONE email, to the departure shop's notification address
 * (fallback: Settings → admin email). Customers get no email at this point.
 */
export async function sendNewOrderEmails(db: DbOrTx, orderId: string) {
  const [loaded, settings] = await Promise.all([loadEmailOrder(db, orderId), getSettings(db)])
  if (!loaded) return
  const to = loaded.shopEmail || settings.adminNotifyEmail || settings.contactEmail
  if (!to) {
    // Nobody to tell: leave a visible trace on the order instead of failing silently.
    await db.insert(notifications).values({
      recipient: "(no address)",
      subject: `New order ${loaded.email.number} — nobody was notified`,
      template: "shop_new_order",
      status: "skipped",
      error: `No notification email for ${loaded.email.storeName ?? "this shop"} (add it in Admin → Shops).`,
      orderId,
    })
    return
  }
  const mail = shopNewOrderEmail(settings.brandName, loaded.email, `${siteUrl()}/admin/orders/${orderId}`)
  await deliver(db, { ...mail, to, template: "shop_new_order", orderId, brand: settings.brandName })
}

/**
 * The only customer email: "your order has been delivered", in the customer's
 * language, and only when they gave an email (on the order or their account).
 */
export async function sendStatusEmail(db: DbOrTx, orderId: string, status: string) {
  if (status !== "delivered") return
  const [loaded, settings] = await Promise.all([loadEmailOrder(db, orderId), getSettings(db)])
  if (!loaded?.customerEmail || !settings.customerEmailsEnabled) return
  const url = `${siteUrl()}/order/${encodeURIComponent(loaded.email.number)}?t=${encodeURIComponent(loaded.accessToken)}`
  const mail = customerDeliveredEmail(settings.brandName, loaded.email, url, loaded.locale)
  await deliver(db, { ...mail, to: loaded.customerEmail, template: "customer_delivered", orderId, brand: settings.brandName })
}
