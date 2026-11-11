"use client"

import * as React from "react"
import { Globe } from "lucide-react"

import { ADMIN_LANG_COOKIE, type AdminLang } from "@/lib/admin-lang"
import { cn } from "@/lib/utils"

const LABELS: Record<AdminLang, string> = { en: "EN", fr: "FR", ar: "ع" }
const NAMES: Record<AdminLang, string> = { en: "English", fr: "Français", ar: "العربية" }

/** Remembers the admin language for a year, then reloads in it (outside React: cookies are browser state). */
function rememberAndReload(l: AdminLang) {
  document.cookie = `${ADMIN_LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`
  window.location.reload()
}

/** Top-of-admin language picker: English · Français · العربية (remembered for a year). */
export function AdminLangSwitch({ lang, className }: { lang: AdminLang; className?: string }) {
  const pick = (l: AdminLang) => {
    if (l === lang) return
    // A full reload: the page is rebuilt in the new language and direction in one go.
    rememberAndReload(l)
  }
  return (
    <div role="group" aria-label="Language / اللغة / Langue" data-no-translate className={cn("inline-flex items-center gap-0.5 rounded-full bg-[color:var(--ios-fill)] p-0.5", className)}>
      <Globe className="mx-1.5 size-3.5 text-[var(--ios-label-2)]" aria-hidden />
      {(Object.keys(LABELS) as AdminLang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          aria-pressed={l === lang}
          title={NAMES[l]}
          className={cn(
            "h-7 min-w-8 rounded-full px-2 text-[12px] font-semibold transition-colors",
            l === lang ? "bg-[color:var(--ios-tint)] text-white" : "text-[var(--ios-label-2)] hover:text-white"
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  )
}
