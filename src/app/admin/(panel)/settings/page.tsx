import type { Metadata } from "next"

import { formatClosureDate, shopClosure } from "@/lib/closure"
import { db } from "@/server/db"
import { getSettings } from "@/server/settings"
import { SettingsForm } from "@/components/admin/site-editors"
import { ShopStatus } from "@/components/admin/shop-status"
import { LinkButton, PageHeader } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const settings = await getSettings(db)
  const closure = shopClosure(settings)
  const status = {
    state: closure.state,
    from: closure.state === "scheduled" ? formatClosureDate(closure.from) : null,
    until: closure.state !== "open" && closure.until ? formatClosureDate(closure.until) : null,
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Settings" actions={<LinkButton href="/admin/products/categories">Categories</LinkButton>}>
        <p className="mt-2 text-sm text-king-gray">Currency: Algerian dinar (DA). Payment: cash on delivery.</p>
      </PageHeader>
      <ShopStatus
        values={{ shopClosed: settings.shopClosed, closedFrom: settings.closedFrom, closedUntil: settings.closedUntil, closedMessage: settings.closedMessage }}
        status={status}
      />
      <SettingsForm values={settings} smtpConfigured={Boolean(process.env.SMTP_HOST)} />
    </div>
  )
}
