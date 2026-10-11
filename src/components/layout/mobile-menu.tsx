"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Menu, Search, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { NAV_LINKS, isActivePath } from "@/lib/site"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Logo } from "@/components/layout/logo"

export function MobileMenu({
  pathname,
  onSearch,
  showOnDesktop = false,
}: {
  pathname: string
  onSearch: () => void
  /** Desktop hides this trigger until the inline links fade out on scroll. */
  showOnDesktop?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className={cn("grid size-11 place-items-center text-king-white", !showOnDesktop && "lg:hidden")}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        data-lenis-prevent
        className="king-grain gap-0 overflow-hidden border-0 bg-king-black p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Site navigation</SheetDescription>

        {/* Red studio light */}
        <div aria-hidden className="pointer-events-none absolute -top-1/4 -right-1/3 h-2/3 w-[120%] king-glow [--glow:rgb(92_7_7_/_0.50)]" />

        <div className="relative flex h-16 items-center px-4 sm:px-6">
          <Logo onClick={close} />
        </div>

        <nav aria-label="Mobile" className="relative flex flex-1 flex-col justify-center px-4 sm:px-6">
          <ul className="space-y-1">
            {NAV_LINKS.map((link, i) => {
              const active = isActivePath(pathname, link.href)
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className="group flex items-baseline gap-4 py-2"
                  >
                    <span className={cn("king-label text-[0.625rem]", active ? "text-king-bright-red" : "text-king-gray")}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "king-display text-[clamp(2.5rem,11.5vw,5rem)] transition-colors duration-300",
                        active ? "text-king-white" : "text-king-muted/70 group-hover:text-king-white"
                      )}
                    >
                      {link.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="relative grid grid-cols-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              close()
              onSearch()
            }}
            className="king-label flex h-16 items-center justify-center gap-2 border-r border-white/10 text-king-muted hover:text-king-white"
          >
            <Search className="size-4" aria-hidden /> Search
          </button>
          <Link
            href="/account"
            onClick={close}
            className="king-label flex h-16 items-center justify-center gap-2 text-king-muted hover:text-king-white"
          >
            <User className="size-4" aria-hidden /> Account
          </Link>
        </div>
        <Link
          href="/clothes"
          onClick={close}
          className="king-label relative flex h-16 items-center justify-between bg-king-red px-4 text-king-white sm:px-6"
        >
          Shop the collection <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </SheetContent>
    </Sheet>
  )
}
