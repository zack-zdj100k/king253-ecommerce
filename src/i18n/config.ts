/** Storefront languages. Admin stays in English. */
export const LOCALES = ["ar", "fr", "en"] as const
export type Locale = (typeof LOCALES)[number]
/** Language for search engines and anyone who hasn't chosen yet (x-default). */
export const DEFAULT_LOCALE: Locale = "fr"
export const LOCALE_COOKIE = "k253_locale"
/** Request header the proxy sets with the locale of this request. */
export const LOCALE_HEADER = "x-king-locale"
/** Original path the proxy saw (before removing the /ar /fr /en prefix). */
export const PATH_HEADER = "x-king-path"

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale)
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr")
export const LOCALE_NAMES: Record<Locale, string> = { ar: "العربية", fr: "Français", en: "English" }

/** "/ar/product/x" → { locale: "ar", path: "/product/x" } */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const m = pathname.match(/^\/(ar|fr|en)(?=\/|$)/)
  if (!m) return { locale: null, path: pathname }
  return { locale: m[1] as Locale, path: pathname.slice(m[0].length) || "/" }
}

export const localePath = (locale: Locale, path: string) => `/${locale}${path === "/" ? "" : path}`
