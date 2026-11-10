import type { DbOrTx } from "../db/client"
import { stores } from "../db/schema"
import { eq } from "drizzle-orm"
import { getSettings } from "../settings"

/** What is still missing before new-order emails can reach the shops. */
export async function emailSetup(db: DbOrTx) {
  const [settings, shops] = await Promise.all([getSettings(db), db.select({ name: stores.name, email: stores.notificationEmail }).from(stores).where(eq(stores.active, true))])
  const fallback = !!(settings.adminNotifyEmail || settings.contactEmail)
  return {
    smtpReady: !!process.env.SMTP_HOST,
    shopsWithoutEmail: fallback ? [] : shops.filter((s) => !s.email).map((s) => s.name),
  }
}
