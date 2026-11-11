import { cookies } from "next/headers"

import { ADMIN_LANG_COOKIE, isAdminLang } from "@/lib/admin-lang"
import { AdminTranslator } from "@/components/admin/admin-translator"
import { ForceLtr } from "@/components/admin/force-ltr"

/** Admin (panel and login): its own language (EN / FR / AR, picked at the top), whatever the storefront visitor chose. */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const raw = (await cookies()).get(ADMIN_LANG_COOKIE)?.value
  const lang = isAdminLang(raw) ? raw : "en"
  const dir = lang === "ar" ? "rtl" : "ltr"
  return (
    <div dir={dir} lang={lang}>
      <ForceLtr dir={dir} lang={lang} />
      <AdminTranslator lang={lang} />
      {children}
    </div>
  )
}
