"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/layout/brand-mark"

/** "/", "/ar", "/fr/", "/en" — the home page in any language. */
const isHome = (pathname: string) => /^\/(ar|fr|en)?\/?$/.test(pathname)

/**
 * Header / menu logo: the real KING 253 artwork with a red glow and a moving red light.
 * From any other page it goes home (the new page opens at the top). Already on the home page, the link
 * would do nothing, so the page scrolls back to the top instead — from the footer or anywhere else.
 */
export function Logo({ className, onClick }: { className?: string; onClick?: () => void }) {
  const pathname = usePathname()
  return (
    <Link
      href="/"
      onClick={(event) => {
        onClick?.()
        if (!isHome(pathname) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
        event.preventDefault()
        if (window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        // The menu (when this logo is inside it) closes first and releases its scroll lock.
        window.setTimeout(() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }), onClick ? 150 : 0)
      }}
      aria-label="KING 253 — home"
      dir="ltr"
      className={cn("group inline-flex items-center", className)}
    >
      <BrandMark className="w-[5.4rem] sm:w-[6rem] lg:w-[7rem]" />
    </Link>
  )
}
