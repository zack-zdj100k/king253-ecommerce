"use client"

import * as React from "react"

/**
 * The admin is always English, left to right. The root <html> is shared with
 * the storefront, so after an in-app jump from the Arabic site it can still say
 * dir="rtl" — fix it here and put the storefront's values back when leaving.
 */
export function ForceLtr() {
  React.useLayoutEffect(() => {
    const html = document.documentElement
    const before = { dir: html.dir, lang: html.lang }
    html.dir = "ltr"
    html.lang = "en"
    return () => {
      html.dir = before.dir
      html.lang = before.lang
    }
  }, [])
  return null
}
