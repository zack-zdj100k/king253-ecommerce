import type { Metadata } from "next"
import { cookies } from "next/headers"

import { ADMIN_LANG_COOKIE, isAdminLang } from "@/lib/admin-lang"

import { db } from "@/server/db"
import { requireAdminPage } from "@/server/auth/session"
import { adminBadges } from "@/server/admin/badges"
import { formatClosureDate, shopClosure } from "@/lib/closure"
import { getSettings } from "@/server/settings"
import { AdminShell } from "@/components/admin/shell"

export const metadata: Metadata = { title: { default: "Admin", template: "%s — KING 253 Admin" }, robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage()
  const settings = await getSettings(db)
  const badges = await adminBadges(db, settings.lowStockThreshold)
  const c = shopClosure(settings)
  const closure = {
    state: c.state,
    from: c.state === "scheduled" ? formatClosureDate(c.from) : null,
    until: c.state !== "open" && c.until ? formatClosureDate(c.until) : null,
  }
  const raw = (await cookies()).get(ADMIN_LANG_COOKIE)?.value
  const lang = isAdminLang(raw) ? raw : "en"
  return (
    <AdminShell lang={lang} user={{ name: user.name, email: user.email ?? user.loginPhone ?? "" }} badges={badges} closure={closure}>
      {children}
    </AdminShell>
  )
}
