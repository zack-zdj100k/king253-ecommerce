"use client"

import { usePathname } from "next/navigation"
import { useLocale } from "next-intl"

import { cn } from "@/lib/utils"
import { LOCALES, LOCALE_NAMES, localePath, splitLocale } from "@/i18n/config"

/** AR · FR · EN — full page loads so the page direction (RTL/LTR) switches too. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale()
  const { path } = splitLocale(usePathname() || "/")
  return (
    <nav aria-label="Language · Langue · اللغة" className={cn("flex items-center gap-1", className)}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={localePath(l, path)}
          // Keep the query string (filters, order token…) without needing useSearchParams.
          onClick={(e) => {
            e.currentTarget.href = localePath(l, path) + window.location.search
          }}
          lang={l}
          hrefLang={l}
          aria-current={l === current ? "true" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            l === current ? "bg-king-white text-king-black" : "text-king-gray hover:text-king-white"
          )}
        >
          {LOCALE_NAMES[l]}
        </a>
      ))}
    </nav>
  )
}
