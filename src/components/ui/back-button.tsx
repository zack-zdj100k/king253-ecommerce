"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"

// Set once the visitor has moved between pages of this site in this tab.
let movedInsideSite = false
// The page before the current one (in-app navigation only).
let previousPath: string | null = null

// Set when a sign-in/up sends the visitor back to the page they came from:
// history is then [that page, that page again], so Back must skip one more.
const AUTH_RETURN = "king:auth-return"
function readReturn() {
  try {
    return sessionStorage.getItem(AUTH_RETURN)
  } catch {
    return null
  }
}
function writeReturn(path: string | null) {
  try {
    if (path) sessionStorage.setItem(AUTH_RETURN, path)
    else sessionStorage.removeItem(AUTH_RETURN)
  } catch {}
}

const isAuthPage = (path: string) => path === "/sign-in" || path === "/sign-up"

/** Called by the auth form before signing in: `next` is where it will land. */
export function markAuthReturn(next: string | undefined) {
  const path = next?.split(/[?#]/)[0]
  writeReturn(path && path === previousPath ? path : null)
}
export const clearAuthReturn = () => writeReturn(null)

/** Mounted once in the root layout: notices in-app page changes. */
export function NavigationTracker() {
  const pathname = usePathname()
  const last = React.useRef(pathname)
  React.useEffect(() => {
    if (pathname !== last.current) {
      movedInsideSite = true
      // Switching between the Sign in / Sign up tabs is not a new page.
      if (!(isAuthPage(last.current) && isAuthPage(pathname))) previousPath = last.current
      last.current = pathname
      const pending = readReturn()
      if (pending && pending !== pathname && !isAuthPage(pathname)) writeReturn(null)
    }
  }, [pathname])
  return null
}

/**
 * "Back" — returns to the previous page when the visitor came from this site,
 * otherwise goes to `fallback` (e.g. someone who opened a shared link).
 */
export function BackButton({ fallback, label = "Back", variant = "site", className }: { fallback: string; label?: string; variant?: "site" | "admin"; className?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        const fromHere = movedInsideSite || (document.referrer !== "" && new URL(document.referrer).origin === window.location.origin)
        if (readReturn() === window.location.pathname && window.history.length > 2) {
          writeReturn(null)
          window.history.go(-2)
        } else if (fromHere && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      className={cn(
        variant === "site"
          ? "king-label inline-flex h-10 items-center gap-2 text-[0.6rem] text-king-muted transition-colors hover:text-king-white"
          : "inline-flex h-9 items-center gap-0.5 text-[17px] text-[var(--ios-tint)] transition-opacity hover:opacity-70 active:opacity-50",
        className
      )}
    >
      {variant === "admin" ? <ChevronLeft className="size-6" strokeWidth={2.4} aria-hidden /> : <ArrowLeft className="size-3.5" aria-hidden />}
      {label}
    </button>
  )
}
