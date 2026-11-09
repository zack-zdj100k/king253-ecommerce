import { headers } from "next/headers"

import { LOCALES, localePath, PATH_HEADER, type Locale } from "./config"

/**
 * canonical + hreflang for the current page: each language has its own URL
 * (/ar/…, /fr/…, /en/…); x-default is the unprefixed URL (French, or the
 * visitor's saved language). Relative URLs resolve against metadataBase.
 */
export async function localeAlternates(locale: Locale, pathOverride?: string) {
  const path = pathOverride ?? ((await headers()).get(PATH_HEADER) || "/")
  return {
    canonical: localePath(locale, path),
    languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])), "x-default": path },
  }
}
