import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./config"

/** The locale of this request: set by src/proxy.ts (URL prefix), else the saved cookie, else the default. */
export async function currentLocale(): Promise<Locale> {
  const fromHeader = (await headers()).get(LOCALE_HEADER)
  if (isLocale(fromHeader)) return fromHeader
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE
}

export default getRequestConfig(async () => {
  const locale = await currentLocale()
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default }
})
