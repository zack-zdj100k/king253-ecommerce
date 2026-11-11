"use client"

import * as React from "react"

/**
 * The admin uses its own language (English by default; Arabic is right to left). The root <html> is shared with
 * the storefront, so after an in-app jump from the Arabic site it can still say
 * dir="rtl" — fix it here and put the storefront's values back when leaving.
 */
export function ForceLtr({ dir = "ltr", lang = "en" }: { dir?: "ltr" | "rtl"; lang?: string }) {
  React.useLayoutEffect(() => {
    const html = document.documentElement
    const before = { dir: html.dir, lang: html.lang }
    html.dir = dir
    html.lang = lang
    return () => {
      html.dir = before.dir
      html.lang = before.lang
    }
  }, [dir, lang])
  return null
}
