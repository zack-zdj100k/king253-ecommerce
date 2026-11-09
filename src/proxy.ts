import { NextResponse, type NextRequest } from "next/server"

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER, PATH_HEADER, splitLocale } from "./i18n/config"

/*
 * Language routing for the storefront.
 *   /ar/…, /fr/…, /en/…  → the same page in that language (prefix removed internally, choice saved in a cookie)
 *   /…                   → the saved language; on a first visit people get the language page, then come back here
 * Search engines and link previews are never sent to the language page (they get French, x-default).
 * Admin is always English.
 */

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|twitter|linkedin|pinterest|lighthouse|headless|google|bing|yandex|baidu|duckduck|semrush|ahrefs|curl|wget/i
const YEAR = 60 * 60 * 24 * 365

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const headers = new Headers(request.headers)

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    headers.set(LOCALE_HEADER, "en")
    return NextResponse.next({ request: { headers } })
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value
  const { locale, path } = splitLocale(pathname)

  if (locale) {
    headers.set(LOCALE_HEADER, locale)
    headers.set(PATH_HEADER, path)
    const url = request.nextUrl.clone()
    url.pathname = path
    const response = NextResponse.rewrite(url, { request: { headers } })
    if (saved !== locale) response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" })
    return response
  }

  const page = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html") && !request.headers.get("rsc")
  if (!isLocale(saved) && page && pathname !== "/language" && !BOTS.test(request.headers.get("user-agent") ?? "")) {
    const url = request.nextUrl.clone()
    url.pathname = "/language"
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  headers.set(LOCALE_HEADER, isLocale(saved) ? saved : DEFAULT_LOCALE)
  headers.set(PATH_HEADER, pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  // Pages only: not API routes, Next internals, uploaded media or files (robots.txt, sitemap.xml, images…).
  matcher: ["/((?!api/|_next/|media/|.*\\.[a-z0-9]+$).*)"],
}
